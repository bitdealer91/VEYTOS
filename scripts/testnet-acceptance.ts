import "dotenv/config";
import {
  Account, AccountAddress, Aptos, AptosConfig, Ed25519PrivateKey, Network,
  generateSignedTransaction, generateUserTransactionHash,
  type InputGenerateTransactionPayloadData, type SimpleTransaction, type UserTransactionResponse,
} from "@aptos-labs/ts-sdk";
import { readFile, writeFile, mkdir, readdir, rename, realpath, stat, open, unlink, cp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { TESTNET_FULLNODE, validateAcceptanceEnvironment, assertOutsideRepository, shouldResubmit } from "./lib/acceptance-config.js";
import { validateManifest } from "../packages/domain/src/metadata.js";

// Explicit testnet-only signing tool; never loads an implicit wallet/CLI profile.
const accountsPath = await realpath(validateAcceptanceEnvironment(process.env));
assertOutsideRepository(await realpath(process.cwd()), accountsPath);
const accountStat = await stat(accountsPath);
assert.equal(accountStat.mode & 0o077, 0, "Testnet account file must have owner-only permissions");
assert(accountStat.isFile(), "Testnet account path must be a file");
const fullnode = TESTNET_FULLNODE;
const apiKey = process.env.APTOS_API_KEY;
const authHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET, fullnode: TESTNET_FULLNODE, ...(apiKey ? { fullnodeConfig: { HEADERS: authHeaders } } : {}) }));
const secret = JSON.parse(await readFile(accountsPath, "utf8")) as Record<string, { address: string; privateKey: string }>;
const load = (role: string) => {
  const record = secret[role];
  assert(record, `Missing ${role} identity; run testnet:accounts`);
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(record.privateKey) });
  assert.equal(account.accountAddress.toStringLong(), record.address, `${role} address/key mismatch`);
  return account;
};
const admin = load("admin"), creator = load("creator"), buyer = load("buyer");
const address = (account: Account) => account.accountAddress.toStringLong();
const moduleAddress = address(admin);
assert.equal(new Set([address(admin), address(creator), address(buyer)]).size, 3, "Admin, creator and buyer must be distinct");
if (process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS) assert.equal(AccountAddress.from(process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS).toStringLong(), moduleAddress, "Configured package must match the publisher");
const roles = { admin: address(admin), creator: address(creator), buyer: address(buyer), treasury: address(admin) };
const moduleFunction = (name: string) => `${moduleAddress}::launchpad::${name}` as const;
const canonical = (value: string) => AccountAddress.from(value).toStringLong();
const ledger = await aptos.getLedgerInfo();
assert.equal(ledger.chain_id, 2, "Wrong network");

async function balance(account: Account, version?: string) {
  const [value] = await aptos.view<[string]>({
    payload: { function: "0x1::coin::balance", typeArguments: ["0x1::aptos_coin::AptosCoin"], functionArguments: [address(account)] },
    ...(version ? { options: { ledgerVersion: BigInt(version) } } : {}),
  });
  return BigInt(value);
}

const sourceFiles = ["move/launchpad/Move.toml", ...(await readdir("move/launchpad/sources")).filter((s) => s.endsWith(".move")).sort().map((s) => `move/launchpad/sources/${s}`)];
const sourceHash = createHash("sha256");
for (const file of sourceFiles) sourceHash.update(file).update(await readFile(file));
const sourceDigest = sourceHash.digest("hex");
type Step = { hash: string; signedBytes: string; version?: string; success?: boolean; gasUsed?: string; gasUnitPrice?: string; vmStatus?: string };
type Journal = { sourceDigest: string; moduleAddress: string; roles: typeof roles; chainId: 2; steps: Record<string, Step> };
const journalPath = process.env.VEYTOS_TESTNET_JOURNAL || ".testnet/journal.json";
let journal: Journal;
try { journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal; }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  journal = { sourceDigest, moduleAddress, roles, chainId: 2, steps: {} };
}
assert.equal(journal.sourceDigest, sourceDigest, "Source changed since this run; use new acceptance identities and journal");
assert.equal(journal.moduleAddress, moduleAddress);
assert.equal(journal.chainId, 2);
assert.deepEqual(journal.roles, roles, "Acceptance account roles changed; do not reuse this journal");
async function saveJournal() {
  await writeFile(`${journalPath}.next`, JSON.stringify(journal, null, 2), { mode: 0o600 });
  await rename(`${journalPath}.next`, journalPath);
}

if (process.argv.includes("--preflight")) {
  console.log(JSON.stringify({ network: "testnet", chainId: ledger.chain_id, moduleAddress, sourceDigest, balanceOctas: (await balance(admin)).toString(), roles: { creator: address(creator), buyer: address(buyer) } }, null, 2));
  process.exit(0);
}

await mkdir(".testnet", { recursive: true, mode: 0o700 });
const lock = await open(".testnet/run.lock", "wx", 0o600);
await lock.writeFile(String(process.pid));
await lock.close();
try {
// Never publish from a failing local suite. The script has no skip-tests switch.
const cli = process.env.APTOS_CLI || "aptos";
// CLI 9.6.0 writes metadata to the package directory even with --output-dir.
// Stage only production sources, then keep metadata and bytecode in one build.
await rm(".testnet/package", { recursive: true, force: true });
await mkdir(".testnet/package", { recursive: true });
await cp("move/launchpad/Move.toml", ".testnet/package/Move.toml");
await cp("move/launchpad/sources", ".testnet/package/sources", { recursive: true });
for (const args of [
  ["move", "test", "--package-dir", "move/launchpad", "--dev"],
  ["move", "compile", "--package-dir", ".testnet/package", "--named-addresses", `launchpad=${moduleAddress}`, "--save-metadata"],
]) {
  const result = spawnSync(cli, args, { stdio: "inherit" });
  if (result.status !== 0 || result.error) throw new Error("Move verification failed; no publication attempted");
}

async function execute(name: string, signer: Account, build: () => Promise<SimpleTransaction>, expectedSuccess = true) {
  let step = journal.steps[name];
  if (!step) {
    const transaction = await build();
    const senderAuthenticator = aptos.transaction.sign({ signer, transaction });
    const input = { transaction, senderAuthenticator };
    step = { hash: generateUserTransactionHash(input), signedBytes: Buffer.from(generateSignedTransaction(input)).toString("hex") };
    journal.steps[name] = step;
    // Persist hash and exact signed bytes BEFORE any submission. Unknown results
    // are reconciled by hash; a rerun never creates a second mint transaction.
    await saveJournal();
  }
  const lookup = await fetch(`${fullnode}/transactions/by_hash/${step.hash}`, { headers: authHeaders });
  if (shouldResubmit(lookup.status)) {
    const response = await fetch(`${fullnode}/transactions`, {
      method: "POST", headers: { "content-type": "application/x.aptos.signed_transaction+bcs", ...authHeaders },
      body: Buffer.from(step.signedBytes, "hex"),
    });
    if (!response.ok) throw new Error(`${name}: submission HTTP ${response.status}: ${await response.text()}. Saved hash ${step.hash}; reconcile before retrying.`);
  }
  const result = await aptos.waitForTransaction({ transactionHash: step.hash, options: { checkSuccess: false, timeoutSecs: 45 } });
  assert.equal(result.type, "user_transaction");
  const tx = result as UserTransactionResponse;
  assert.equal(canonical(tx.sender), address(signer), `${name}: sender mismatch`);
  assert.equal(tx.hash, step.hash);
  step.version = tx.version; step.success = tx.success;
  step.gasUsed = tx.gas_used; step.gasUnitPrice = tx.gas_unit_price; step.vmStatus = tx.vm_status;
  await saveJournal();
  assert.equal(tx.success, expectedSuccess, `${name}: ${tx.vm_status}`);
  console.log(`${name}: ${tx.hash} (${tx.success ? "committed" : "expected abort"})`);
  return tx;
}
const entry = (name: string, signer: Account, data: InputGenerateTransactionPayloadData, success = true) =>
  execute(name, signer, async () => {
    const transaction = await aptos.transaction.build.simple({ sender: signer.accountAddress, data, options: { maxGasAmount: 500_000 } });
    if (success) {
      const [simulation] = await aptos.transaction.simulate.simple({ signerPublicKey: signer.publicKey, transaction });
      assert(simulation?.success, `${name}: simulation failed: ${simulation?.vm_status}; nothing signed`);
    }
    return transaction;
  }, success);

if (!journal.steps.publish) assert(await balance(admin) >= 500_000_000n, "Fund the deployer with at least 5 testnet APT for this acceptance run");
const buildRoot = ".testnet/package/build/MintosLaunchpad";
const modules = (await readdir(`${buildRoot}/bytecode_modules`)).filter((p) => p.endsWith(".mv")).sort();
assert.deepEqual(modules, ["fee_policy.mv", "launchpad.mv"], "Publish production modules only");
const publish = await execute("publish", admin, async () => aptos.publishPackageTransaction({
  account: admin.accountAddress,
  metadataBytes: new Uint8Array(await readFile(`${buildRoot}/package-metadata.bcs`)),
  moduleBytecode: await Promise.all(modules.map(async (file) => new Uint8Array(await readFile(`${buildRoot}/bytecode_modules/${file}`)))),
  options: { maxGasAmount: 2_000_000 },
}));
const deployedModules = [];
for (const file of modules) {
  const name = file.slice(0, -3);
  const local = await readFile(`${buildRoot}/bytecode_modules/${file}`);
  const deployed = await aptos.getAccountModule({ accountAddress: moduleAddress, moduleName: name, options: { ledgerVersion: BigInt(publish.version) } });
  assert.equal(deployed.bytecode, `0x${local.toString("hex")}`, `${name}: published bytecode mismatch`);
  deployedModules.push({ name, sha256: createHash("sha256").update(local).digest("hex"), matchesPublished: true });
}
const registry = await aptos.getAccountResource<{ packages: { name: string; upgrade_policy: { policy: number }; upgrade_number: string; source_digest: string }[] }>({ accountAddress: moduleAddress, resourceType: "0x1::code::PackageRegistry", options: { ledgerVersion: BigInt(publish.version) } });
const packageRecord = registry.packages.find((p) => p.name === "MintosLaunchpad");
assert(packageRecord);
assert.equal(packageRecord.upgrade_policy.policy, 1, "Gate A package uses compatible upgrades");
const publishedPackage = { name: packageRecord.name, upgrade_policy: packageRecord.upgrade_policy, upgrade_number: packageRecord.upgrade_number, source_digest: packageRecord.source_digest };
await entry("initialize", admin, { function: `${moduleAddress}::fee_policy::initialize`, functionArguments: [roles.treasury] });
const [feeBps, treasury, paused, chainAdmin] = await aptos.view<[string, string, boolean, string]>({ payload: { function: `${moduleAddress}::fee_policy::configuration`, functionArguments: [] } });
assert.equal(feeBps, "500"); assert.equal(canonical(treasury), roles.treasury);
assert.equal(canonical(chainAdmin), roles.admin); assert.equal(paused, false);
for (const [role, account] of [["creator", creator], ["buyer", buyer]] as const) {
  await entry(`fund-${role}`, admin, { function: "0x1::aptos_account::transfer", functionArguments: [address(account), "100000000"] });
}
await entry("fund-creator-storage", admin, { function: "0x1::aptos_account::transfer", functionArguments: [address(creator), "200000000"] });

// Real content hashes for reproducible TEST fixtures. Content is saved locally;
// this is not a claim of public IPFS pinning or a production metadata upload.
await mkdir(".testnet/metadata", { recursive: true });
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=", "base64");
const imageCid = CID.createV1(0x55, await sha256.digest(image)).toString();
await writeFile(`.testnet/metadata/${imageCid}`, image);
async function storeMetadata(value: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const cid = CID.createV1(0x55, await sha256.digest(bytes)).toString();
  await writeFile(`.testnet/metadata/${cid}`, bytes);
  return `ipfs://${cid}`;
}
const collectionUri = await storeMetadata({ name: "Gate A acceptance", description: "Disposable Aptos testnet contract acceptance collection", image: `ipfs://${imageCid}` });
const tokens = await Promise.all(Array.from({ length: 100 }, async (_, i) => {
  const metadata = { name: `Gate A #${i + 1}`, description: "Testnet contract acceptance fixture. Not a production collectible.", image: `ipfs://${imageCid}`, attributes: [{ trait_type: "Serial", value: i + 1 }] };
  return { id: i + 1, metadataUri: await storeMetadata(metadata), metadata };
}));
validateManifest({ version: 1, tokens }, 100);
const id = new TextEncoder().encode("gate-a-v1");
// Existing journal entries are reconciled by execute(), including unknown submissions.
// The placeholder start is never signed when a prepare transaction already exists.
const start = journal.steps.prepare ? "0" : (BigInt((await aptos.getLedgerInfo()).ledger_timestamp) / 1_000_000n + 30n).toString();
await entry("prepare", creator, { function: moduleFunction("prepare_drop"), functionArguments: [id, "Gate A acceptance", "Disposable testnet collection", collectionUri, "100", "10000000", "10", "5", start, "0", "750", "500"] });
const [drop] = await aptos.view<[string]>({ payload: { function: moduleFunction("drop_address"), functionArguments: [address(creator), id] } });
for (let offset = 0; offset < tokens.length; offset += 25) {
  const chunk = tokens.slice(offset, offset + 25);
  await entry(`metadata-${offset}`, creator, { function: moduleFunction("append_metadata"), functionArguments: [drop, offset.toString(), chunk.map((t) => t.metadata.name), chunk.map((t) => t.metadataUri)] });
}
const finalize = await entry("finalize", creator, { function: moduleFunction("finalize_drop"), functionArguments: [drop, "500"] });
const [dropState] = await aptos.view<[{ terms: { start_seconds: string; fee_bps: string; unit_price: string; wallet_limit: string; transaction_limit: string }; finalized: boolean }]>({ payload: { function: moduleFunction("get_drop"), functionArguments: [drop] } });
assert.equal(dropState.finalized, true); assert.equal(dropState.terms.fee_bps, "500");
assert.equal(dropState.terms.unit_price, "10000000"); assert.equal(dropState.terms.wallet_limit, "10"); assert.equal(dropState.terms.transaction_limit, "5");
while (BigInt((await aptos.getLedgerInfo()).ledger_timestamp) / 1_000_000n < BigInt(dropState.terms.start_seconds)) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
const mint = await entry("mint-two", buyer, { function: moduleFunction("mint"), functionArguments: [drop, "2", "10000000", "20000000"] });
const versionBefore = (BigInt(mint.version) - 1n).toString();
const before = await Promise.all([buyer, creator, admin].map((a) => balance(a, versionBefore)));
const after = await Promise.all([buyer, creator, admin].map((a) => balance(a, mint.version)));
const gas = BigInt(mint.gas_used) * BigInt(mint.gas_unit_price);
assert.equal(before[0]! - after[0]!, 20_000_000n + gas);
assert.equal(after[1]! - before[1]!, 19_000_000n);
assert.equal(after[2]! - before[2]!, 1_000_000n);
const events = mint.events.filter((event) => event.type === `${moduleAddress}::launchpad::NFTMinted`);
assert.equal(events.length, 2);
const [collection] = await aptos.view<[string]>({ payload: { function: moduleFunction("collection_address"), functionArguments: [drop] } });
const nativeCollection = await aptos.getAccountResource<{ creator: string; name: string; uri: string }>({ accountAddress: collection, resourceType: "0x4::collection::Collection", options: { ledgerVersion: BigInt(mint.version) } });
assert.equal(canonical(nativeCollection.creator), canonical(drop));
assert.equal(nativeCollection.name, "Gate A acceptance");
assert.equal(nativeCollection.uri, collectionUri);
const [nativeSupply] = await aptos.view<[{ vec: string[] }]>({ payload: { function: "0x4::collection::count", typeArguments: ["0x4::collection::Collection"], functionArguments: [collection] }, options: { ledgerVersion: BigInt(mint.version) } });
assert.deepEqual(nativeSupply.vec, ["2"]);
const owned = [];
for (const [i, event] of events.entries()) {
  assert.equal(canonical(event.data.buyer), address(buyer));
  assert.equal(canonical(event.data.creator), address(creator));
  assert.equal(canonical(event.data.treasury), address(admin));
  assert.equal(BigInt(event.data.serial), BigInt(i + 1));
  assert.equal(BigInt(event.data.fee), 500_000n);
  assert.equal(BigInt(event.data.creator_revenue), 9_500_000n);
  const nft = await aptos.getAccountResource<{ collection: { inner: string }; uri: string }>({ accountAddress: event.data.token, resourceType: "0x4::token::Token", options: { ledgerVersion: BigInt(mint.version) } });
  const core = await aptos.getAccountResource<{ owner: string }>({ accountAddress: event.data.token, resourceType: "0x1::object::ObjectCore", options: { ledgerVersion: BigInt(mint.version) } });
  assert.equal(canonical(core.owner), address(buyer));
  assert.equal(canonical(nft.collection.inner), canonical(collection));
  assert.equal(nft.uri, tokens[i]!.metadataUri);
  owned.push({ address: event.data.token, owner: core.owner, collection: nft.collection.inner, metadataUri: nft.uri });
}
const [progress] = await aptos.view<[string[]]>({ payload: { function: moduleFunction("progress"), functionArguments: [drop] } });
assert.deepEqual(progress, ["100", "2", "100"]);
const [walletMints] = await aptos.view<[string]>({ payload: { function: moduleFunction("minted_by"), functionArguments: [drop, address(buyer)] } });
assert.equal(walletMints, "2");
const royalties = await aptos.getAccountResource<{ numerator: string; denominator: string; payee_address: string }>({ accountAddress: collection, resourceType: "0x4::royalty::Royalty" });
assert.equal(royalties.numerator, "750"); assert.equal(royalties.denominator, "10000"); assert.equal(canonical(royalties.payee_address), address(creator));
const negative = await entry("reject-max-total", buyer, { function: moduleFunction("mint"), functionArguments: [drop, "1", "10000000", "9999999"] }, false);
assert.match(negative.vm_status, /0xf|15|EMAX_TOTAL/i);
const negativeBefore = (BigInt(negative.version) - 1n).toString();
for (const account of [creator, admin]) assert.equal(await balance(account, negativeBefore), await balance(account, negative.version));
assert.equal(await balance(buyer, negativeBefore) - await balance(buyer, negative.version), BigInt(negative.gas_used) * BigInt(negative.gas_unit_price));
assert.equal(negative.events.filter((e) => e.type === `${moduleAddress}::launchpad::NFTMinted`).length, 0);
const [afterFailure] = await aptos.view<[string[]]>({ payload: { function: moduleFunction("progress"), functionArguments: [drop] } });
assert.deepEqual(afterFailure, progress);

const evidence = {
  network: "testnet", chainId: 2, verifiedAt: new Date().toISOString(), sourceDigest,
  frameworkRevision: "1b116b414ccc1d860fa72160d9b9a770e8d8e88f", sdk: "7.3.0", moduleAddress,
  roles,
  deploymentVersion: publish.version, deployedModules, publishedPackage, drop, terms: dropState.terms, collection, nativeCollection, nativeSupply, royalties, progress, walletMints,
  unitPriceOctas: "10000000", quantity: 2, grossOctas: "20000000", platformOctas: "1000000", creatorOctas: "19000000", buyerGasOctas: gas.toString(),
  before: before.map(String), after: after.map(String), minted: owned, canonicalEvents: events,
  transactions: Object.fromEntries(Object.entries(journal.steps).map(([name, { signedBytes: _signedBytes, ...receipt }]) => [name, receipt])),
  finalizeHash: finalize.hash, mintHash: mint.hash, rejectedHash: negative.hash,
  metadataAvailability: "Content-addressed fixtures saved locally in .testnet/metadata; no public IPFS pinning claimed",
  limitations: ["No wallet UI", "No external audit", "Compatible upgrades; testnet only", "Database not required or migrated"],
};
await writeFile("docs/evidence/testnet-acceptance.json", JSON.stringify(evidence, null, 2) + "\n");
console.log("Gate A contract acceptance verified. Evidence: docs/evidence/testnet-acceptance.json");
} finally {
  await unlink(".testnet/run.lock");
}
