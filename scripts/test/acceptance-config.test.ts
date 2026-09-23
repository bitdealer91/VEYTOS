import { test } from "node:test";
import assert from "node:assert/strict";
import { assertOutsideRepository, shouldResubmit, validateAcceptanceEnvironment, TESTNET_FULLNODE } from "../lib/acceptance-config.js";

test("acceptance rejects mainnet or mismatched browser network", () => {
  const env = { MINTOS_TESTNET_ACCOUNTS_FILE: "/outside/accounts.json" };
  assert.throws(() => validateAcceptanceEnvironment({ ...env, APTOS_NETWORK: "mainnet" }));
  assert.throws(() => validateAcceptanceEnvironment({ ...env, NEXT_PUBLIC_APTOS_NETWORK: "devnet" }));
  assert.equal(validateAcceptanceEnvironment({ ...env, APTOS_NETWORK: "testnet" }), env.MINTOS_TESTNET_ACCOUNTS_FILE);
});
test("acceptance requires explicit key path and rejects endpoint drift", () => {
  assert.throws(() => validateAcceptanceEnvironment({}));
  assert.throws(() => validateAcceptanceEnvironment({ MINTOS_TESTNET_ACCOUNTS_FILE: ".testnet/accounts.json" }));
  assert.throws(() => validateAcceptanceEnvironment({ MINTOS_TESTNET_ACCOUNTS_FILE: "/outside/key", APTOS_FULLNODE_URL: "https://api.mainnet.aptoslabs.com/v1" }));
  assert.equal(validateAcceptanceEnvironment({ MINTOS_TESTNET_ACCOUNTS_FILE: "/outside/key", APTOS_FULLNODE_URL: TESTNET_FULLNODE }), "/outside/key");
});
test("keys cannot be kept inside the repository even in ignored directories", () => {
  assert.throws(() => assertOutsideRepository("/repo", "/repo/.testnet/accounts.json"));
  assert.throws(() => assertOutsideRepository("/repo", "/repo"));
  assert.doesNotThrow(() => assertOutsideRepository("/repo", "/secure/accounts.json"));
  assert.doesNotThrow(() => assertOutsideRepository("/repo", "/repo-other/accounts.json"));
});
test("transaction retries stop on ambiguous server failures", () => {
  assert.equal(shouldResubmit(404), true);
  assert.equal(shouldResubmit(200), false);
  for (const status of [401, 403, 429, 500, 503]) assert.throws(() => shouldResubmit(status));
});
