import { test } from "node:test";
import assert from "node:assert/strict";
import { readPublicConfig } from "../src/index.js";

test("development has no invented contract address", () => {
  const config=readPublicConfig({});assert.equal(config.NEXT_PUBLIC_APTOS_NETWORK, "testnet");
  assert.equal(config.NEXT_PUBLIC_LAUNCHPAD_ADDRESS, undefined);
  assert.equal(config.NEXT_PUBLIC_FEEDBACK_URL,"https://github.com/bitdealer91/VEYTOS/issues/new/choose");
});
test("mainnet fails closed without an address and HTTPS origin", () => {
  assert.throws(() => readPublicConfig({ NEXT_PUBLIC_APTOS_NETWORK: "mainnet" }));
  assert.throws(() => readPublicConfig({ NEXT_PUBLIC_APTOS_NETWORK: "mainnet", NEXT_PUBLIC_LAUNCHPAD_ADDRESS: "0xab" }));
  const env = { NEXT_PUBLIC_APTOS_NETWORK: "mainnet", NEXT_PUBLIC_LAUNCHPAD_ADDRESS: "0xAB", NEXT_PUBLIC_APP_URL: "https://example.com" };
  assert.equal(readPublicConfig(env).NEXT_PUBLIC_LAUNCHPAD_ADDRESS, `0x${"ab".padStart(64, "0")}`);
});
test("network mismatch, unknown networks and zero addresses are rejected", () => {
  assert.throws(() => readPublicConfig({ APTOS_NETWORK: "mainnet", NEXT_PUBLIC_APTOS_NETWORK: "testnet" }));
  assert.throws(() => readPublicConfig({ NEXT_PUBLIC_APTOS_NETWORK: "typo" }));
  assert.throws(() => readPublicConfig({ NEXT_PUBLIC_LAUNCHPAD_ADDRESS: "0x0" }));
});
