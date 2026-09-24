import "dotenv/config";
import {
  Account,
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
  generateSignedTransaction,
  generateUserTransactionHash,
  type InputGenerateTransactionPayloadData,
  type SimpleTransaction,
  type UserTransactionResponse,
} from "@aptos-labs/ts-sdk";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmod,
  cp,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import {
  TESTNET_FULLNODE,
  assertOutsideRepository,
  shouldResubmit,
  validateAcceptanceEnvironment,
} from "./lib/acceptance-config.js";

type SecretRecord = { address: string; privateKey: string };
type Step = {
  hash: string;
  signedBytes: string;
  version?: string;
  success?: boolean;
  gasUsed?: string;
  gasUnitPrice?: string;
  vmStatus?: string;
};

const accountsPath = await realpath(validateAcceptanceEnvironment(process.env));
const repositoryRoot = await realpath(process.cwd());
assertOutsideRepository(repositoryRoot, accountsPath);
const accountStat = await stat(accountsPath);
assert(accountStat.isFile(), "Testnet account path must be a file");
assert.equal(accountStat.mode & 0o077, 0, "Testnet account file must have owner-only permissions");

const secrets = JSON.parse(await readFile(accountsPath, "utf8")) as Record<string, SecretRecord>;
let accountsChanged = false;
for (const role of ["marketplaceBuyer", "marketplaceTreasury"]) {
  if (!secrets[role]) {
    const generated = Account.generate();
    secrets[role] = {
      address: generated.accountAddress.toStringLong(),
      privateKey: generated.privateKey.toString(),
    };
    accountsChanged = true;
  }
}
if (accountsChanged) {
  const nextPath = `${accountsPath}.next`;
  assertOutsideRepository(repositoryRoot, nextPath);
  await mkdir(dirname(accountsPath), { recursive: true, mode: 0o700 });
  await writeFile(nextPath, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
  await rename(nextPath, accountsPath);
  await chmod(accountsPath, 0o600);
}

const load = (role: string) => {
  const record = secrets[role];
  assert(record, `Missing ${role} identity`);
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(record.privateKey) });
  assert.equal(account.accountAddress.toStringLong(), record.address, `${role} address/key mismatch`);
  return account;
};
const address = (account: Account) => account.accountAddress.toStringLong();
const canonical = (value: string) => AccountAddress.from(value).toStringLong();

const admin = load("admin");
const royaltyRecipient = load("creator");
const seller = load("buyer");
const buyer = load("marketplaceBuyer");
const treasury = load("marketplaceTreasury");
const roles = {
  admin: address(admin),
  seller: address(seller),
  buyer: address(buyer),
  treasury: address(treasury),
  royaltyRecipient: address(royaltyRecipient),
};
assert.equal(new Set(Object.values(roles)).size, 5, "Gate D roles must be independent");

const moduleAddress = roles.admin;
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const ledger = await aptos.getLedgerInfo();
assert.equal(ledger.chain_id, 2, "Wrong network");

const gateA = JSON.parse(await readFile("docs/evidence/testnet-acceptance.json", "utf8")) as {
  collection: string;
  minted: { address: string; owner: string }[];
  royalties: { numerator: string; denominator: string; payee_address: string };
};
const collectionAddress = canonical(gateA.collection);
const tokenAddress = canonical(gateA.minted[0]!.address);
assert.equal(canonical(gateA.minted[0]!.owner), roles.seller);
assert.equal(gateA.royalties.numerator, "750");
assert.equal(gateA.royalties.denominator, "10000");
assert.equal(canonical(gateA.royalties.payee_address), roles.royaltyRecipient);

async function balance(account: Account, version?: string) {
  const [value] = await aptos.view<[string]>({
    payload: {
      function: "0x1::coin::balance",
      typeArguments: ["0x1::aptos_coin::AptosCoin"],
      functionArguments: [address(account)],
    },
    ...(version ? { options: { ledgerVersion: BigInt(version) } } : {}),
  });
  return BigInt(value);
}

async function owner(token: string, version?: string) {
  const core = await aptos.getAccountResource<{ owner: string }>({
    accountAddress: token,
    resourceType: "0x1::object::ObjectCore",
    ...(version ? { options: { ledgerVersion: BigInt(version) } } : {}),
  });
  return canonical(core.owner);
}

const currentOwner = await owner(tokenAddress);
assert(
  currentOwner === roles.seller || currentOwner === roles.buyer,
  "Selected VEYTOS NFT is not held by the Gate D seller or committed Gate D buyer",
);

const sourceFiles = [
  "move/marketplace/Move.toml",
  ...(await readdir("move/marketplace/sources"))
    .filter((file) => file.endsWith(".move"))
    .sort()
    .map((file) => `move/marketplace/sources/${file}`),
];
const sourceHash = createHash("sha256");
for (const file of sourceFiles) sourceHash.update(file).update(await readFile(file));
const sourceDigest = sourceHash.digest("hex");

type Journal = {
  sourceDigest: string;
  moduleAddress: string;
  roles: typeof roles;
  chainId: 2;
  tokenAddress: string;
  collectionAddress: string;
  steps: Record<string, Step>;
};
const journalPath = ".testnet/marketplace-v2-journal.json";
let journal: Journal;
try {
  journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  journal = {
    sourceDigest,
    moduleAddress,
    roles,
    chainId: 2,
    tokenAddress,
    collectionAddress,
    steps: {},
  };
}
assert.equal(journal.sourceDigest, sourceDigest, "Marketplace source changed; start a new acceptance journal");
assert.equal(journal.moduleAddress, moduleAddress);
assert.equal(journal.chainId, 2);
assert.deepEqual(journal.roles, roles);
assert.equal(journal.tokenAddress, tokenAddress);
assert.equal(journal.collectionAddress, collectionAddress);

async function saveJournal() {
  await writeFile(`${journalPath}.next`, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  await rename(`${journalPath}.next`, journalPath);
}

async function execute(
  name: string,
  signer: Account,
  build: () => Promise<SimpleTransaction>,
  expectedSuccess = true,
) {
  let step = journal.steps[name];
  if (!step) {
    const transaction = await build();
    const senderAuthenticator = aptos.transaction.sign({ signer, transaction });
    const input = { transaction, senderAuthenticator };
    step = {
      hash: generateUserTransactionHash(input),
      signedBytes: Buffer.from(generateSignedTransaction(input)).toString("hex"),
    };
    journal.steps[name] = step;
    await saveJournal();
  }
  const lookup = await fetch(`${TESTNET_FULLNODE}/transactions/by_hash/${step.hash}`);
  if (shouldResubmit(lookup.status)) {
    const response = await fetch(`${TESTNET_FULLNODE}/transactions`, {
      method: "POST",
      headers: { "content-type": "application/x.aptos.signed_transaction+bcs" },
      body: Buffer.from(step.signedBytes, "hex"),
    });
    if (!response.ok) {
      throw new Error(`${name}: submission HTTP ${response.status}: ${await response.text()}; hash ${step.hash}`);
    }
  }
  const result = await aptos.waitForTransaction({
    transactionHash: step.hash,
    options: { checkSuccess: false, timeoutSecs: 60 },
  });
  assert.equal(result.type, "user_transaction");
  const transaction = result as UserTransactionResponse;
  assert.equal(canonical(transaction.sender), address(signer), `${name}: sender mismatch`);
  assert.equal(transaction.hash, step.hash);
  step.version = transaction.version;
  step.success = transaction.success;
  step.gasUsed = transaction.gas_used;
  step.gasUnitPrice = transaction.gas_unit_price;
  step.vmStatus = transaction.vm_status;
  await saveJournal();
  assert.equal(transaction.success, expectedSuccess, `${name}: ${transaction.vm_status}`);
  console.log(`${name}: ${transaction.hash} (${transaction.success ? "committed" : "expected abort"})`);
  return transaction;
}

const entry = (
  name: string,
  signer: Account,
  data: InputGenerateTransactionPayloadData,
) => execute(name, signer, async () => {
  const transaction = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data,
    options: { maxGasAmount: 500_000 },
  });
  const [simulation] = await aptos.transaction.simulate.simple({
    signerPublicKey: signer.publicKey,
    transaction,
  });
  assert(simulation?.success, `${name}: simulation failed: ${simulation?.vm_status}; nothing signed`);
  return transaction;
});

await mkdir(".testnet", { recursive: true, mode: 0o700 });
const lockPath = ".testnet/marketplace-v2-run.lock";
const lock = await open(lockPath, "wx", 0o600);
await lock.writeFile(String(process.pid));
await lock.close();

try {
  const cli = process.env.APTOS_CLI || "aptos";
  const stagedPackage = ".testnet/marketplace-package";
  await rm(stagedPackage, { recursive: true, force: true });
  await mkdir(stagedPackage, { recursive: true });
  await cp("move/marketplace/Move.toml", `${stagedPackage}/Move.toml`);
  await cp("move/marketplace/sources", `${stagedPackage}/sources`, { recursive: true });
  for (const args of [
    ["move", "test", "--package-dir", "move/marketplace", "--dev"],
    ["move", "compile", "--package-dir", stagedPackage, "--named-addresses", `marketplace=${moduleAddress}`, "--save-metadata"],
  ]) {
    const result = spawnSync(cli, args, { stdio: "inherit" });
    if (result.status !== 0 || result.error) throw new Error("Move verification failed; no publication attempted");
  }

  const buildRoot = `${stagedPackage}/build/VeytosMarketplace`;
  const modules = (await readdir(`${buildRoot}/bytecode_modules`)).filter((file) => file.endsWith(".mv")).sort();
  assert.deepEqual(
    modules,
    ["marketplace.mv", "marketplace_fee_policy.mv", "settlement_v2.mv"],
    "Publish production modules only",
  );

  const publish = await execute("publish", admin, async () => aptos.publishPackageTransaction({
    account: admin.accountAddress,
    metadataBytes: new Uint8Array(await readFile(`${buildRoot}/package-metadata.bcs`)),
    moduleBytecode: await Promise.all(modules.map(async (file) => (
      new Uint8Array(await readFile(`${buildRoot}/bytecode_modules/${file}`))
    ))),
    options: { maxGasAmount: 2_000_000 },
  }));

  const deployedModules = [];
  for (const file of modules) {
    const name = file.slice(0, -3);
    const local = await readFile(`${buildRoot}/bytecode_modules/${file}`);
    const deployed = await aptos.getAccountModule({
      accountAddress: moduleAddress,
      moduleName: name,
      options: { ledgerVersion: BigInt(publish.version) },
    });
    assert.equal(deployed.bytecode, `0x${local.toString("hex")}`, `${name}: published bytecode mismatch`);
    deployedModules.push({
      name,
      sha256: createHash("sha256").update(local).digest("hex"),
      matchesPublished: true,
    });
  }

  await entry("initialize-fee-policy", admin, {
    function: `${moduleAddress}::marketplace_fee_policy::initialize`,
    functionArguments: [roles.treasury],
  });
  await entry("initialize-marketplace", admin, {
    function: `${moduleAddress}::marketplace::initialize`,
    functionArguments: [],
  });
  await entry("initialize-v2", admin, {
    function: `${moduleAddress}::settlement_v2::initialize`,
    functionArguments: [],
  });
  await entry("fund-marketplace-buyer", admin, {
    function: "0x1::aptos_account::transfer",
    functionArguments: [roles.buyer, "200000000"],
  });
  await entry("fund-marketplace-treasury", admin, {
    function: "0x1::aptos_account::transfer",
    functionArguments: [roles.treasury, "1000000"],
  });
  await entry("approve-veytos-collection", admin, {
    function: `${moduleAddress}::marketplace::set_v2_collection_reviewed`,
    functionArguments: [collectionAddress, 1, true],
  });

  const configuration = await aptos.view<[string, string, boolean, boolean, boolean, string]>({
    payload: { function: `${moduleAddress}::marketplace_fee_policy::configuration`, functionArguments: [] },
  });
  assert.equal(configuration[0], "200");
  assert.equal(canonical(configuration[1]), roles.treasury);
  assert.deepEqual(configuration.slice(2, 5), [false, false, false]);
  const policy = await aptos.view<[boolean, number]>({
    payload: {
      function: `${moduleAddress}::marketplace::v2_collection_policy`,
      functionArguments: [collectionAddress],
    },
  });
  assert.deepEqual(policy, [true, 1]);

  const gross = 10_000_000n;
  const expectedFee = 200_000n;
  const expectedRoyalty = 750_000n;
  const expectedSellerProceeds = 9_050_000n;
  assert.equal(gross, expectedFee + expectedRoyalty + expectedSellerProceeds);

  const firstList = await entry("list-first", seller, {
    function: `${moduleAddress}::settlement_v2::list`,
    functionArguments: [tokenAddress, gross.toString()],
  });
  const firstListed = firstList.events.find((event) => event.type === `${moduleAddress}::marketplace::NFTListed`);
  assert(firstListed, "First NFTListed event missing");
  const firstListingId = String(firstListed.data.listing_id);
  assert.equal(firstListed.data.gross_price, gross.toString());
  assert.equal(firstListed.data.fee_bps, "200");
  assert.equal(firstListed.data.royalty_numerator, "750");
  assert.equal(firstListed.data.royalty_denominator, "10000");
  assert.equal(canonical(firstListed.data.royalty_payee), roles.royaltyRecipient);
  const [firstEscrow] = await aptos.view<[string]>({
    payload: {
      function: `${moduleAddress}::settlement_v2::escrow_address`,
      functionArguments: [firstListingId],
    },
    options: { ledgerVersion: BigInt(firstList.version) },
  });
  assert.equal(await owner(tokenAddress, firstList.version), canonical(firstEscrow));
  const treasuryAfterFirstList = await balance(treasury, firstList.version);
  const royaltyAfterFirstList = await balance(royaltyRecipient, firstList.version);

  const cancel = await entry("cancel-first", seller, {
    function: `${moduleAddress}::settlement_v2::cancel`,
    functionArguments: [firstListingId],
  });
  const cancelled = cancel.events.find((event) => event.type === `${moduleAddress}::marketplace::ListingCancelled`);
  assert(cancelled, "ListingCancelled event missing");
  assert.equal(cancelled.data.listing_id, firstListingId);
  assert.equal(canonical(cancelled.data.seller), roles.seller);
  assert.equal(await owner(tokenAddress, cancel.version), roles.seller);
  const [firstStatus] = await aptos.view<[number]>({
    payload: { function: `${moduleAddress}::marketplace::listing_status`, functionArguments: [firstListingId] },
    options: { ledgerVersion: BigInt(cancel.version) },
  });
  assert.equal(firstStatus, 2);
  assert.equal(await balance(treasury, cancel.version), treasuryAfterFirstList);
  assert.equal(await balance(royaltyRecipient, cancel.version), royaltyAfterFirstList);

  const secondList = await entry("list-second", seller, {
    function: `${moduleAddress}::settlement_v2::list`,
    functionArguments: [tokenAddress, gross.toString()],
  });
  const secondListed = secondList.events.find((event) => event.type === `${moduleAddress}::marketplace::NFTListed`);
  assert(secondListed, "Second NFTListed event missing");
  const secondListingId = String(secondListed.data.listing_id);
  assert.notEqual(secondListingId, firstListingId);
  const [secondEscrow] = await aptos.view<[string]>({
    payload: {
      function: `${moduleAddress}::settlement_v2::escrow_address`,
      functionArguments: [secondListingId],
    },
    options: { ledgerVersion: BigInt(secondList.version) },
  });
  assert.equal(await owner(tokenAddress, secondList.version), canonical(secondEscrow));

  const beforeBuyVersion = secondList.version;
  const beforeBuy = await Promise.all([
    balance(buyer, beforeBuyVersion),
    balance(seller, beforeBuyVersion),
    balance(treasury, beforeBuyVersion),
    balance(royaltyRecipient, beforeBuyVersion),
  ]);
  const buy = await entry("buy-second", buyer, {
    function: `${moduleAddress}::settlement_v2::buy`,
    functionArguments: [secondListingId, gross.toString()],
  });
  const afterBuy = await Promise.all([
    balance(buyer, buy.version),
    balance(seller, buy.version),
    balance(treasury, buy.version),
    balance(royaltyRecipient, buy.version),
  ]);
  const feeStatement = buy.events.find((event) => event.type === "0x1::transaction_fee::FeeStatement");
  assert(feeStatement, "Aptos FeeStatement event missing");
  const grossGasCharge = BigInt(buy.gas_used) * BigInt(buy.gas_unit_price);
  const storageRefund = BigInt(feeStatement.data.storage_fee_refund_octas);
  const netGasCharge = grossGasCharge - storageRefund;
  assert.equal(beforeBuy[0]! - afterBuy[0]!, gross + netGasCharge);
  assert.equal(afterBuy[1]! - beforeBuy[1]!, expectedSellerProceeds);
  assert.equal(afterBuy[2]! - beforeBuy[2]!, expectedFee);
  assert.equal(afterBuy[3]! - beforeBuy[3]!, expectedRoyalty);
  assert.equal(await owner(tokenAddress, buy.version), roles.buyer);
  const [secondStatus] = await aptos.view<[number]>({
    payload: { function: `${moduleAddress}::marketplace::listing_status`, functionArguments: [secondListingId] },
    options: { ledgerVersion: BigInt(buy.version) },
  });
  assert.equal(secondStatus, 3);

  const purchased = buy.events.find((event) => event.type === `${moduleAddress}::marketplace::NFTPurchased`);
  assert(purchased, "NFTPurchased event missing");
  assert.equal(purchased.data.listing_id, secondListingId);
  assert.equal(canonical(purchased.data.seller), roles.seller);
  assert.equal(canonical(purchased.data.buyer), roles.buyer);
  assert.equal(purchased.data.gross_price, gross.toString());
  assert.equal(canonical(purchased.data.platform_fee_recipient), roles.treasury);
  assert.equal(purchased.data.platform_fee, expectedFee.toString());
  assert.equal(canonical(purchased.data.royalty_recipient), roles.royaltyRecipient);
  assert.equal(purchased.data.royalty, expectedRoyalty.toString());
  assert.equal(purchased.data.seller_proceeds, expectedSellerProceeds.toString());

  const packageRegistry = await aptos.getAccountResource<{
    packages: { name: string; upgrade_policy: { policy: number }; upgrade_number: string; source_digest: string }[];
  }>({ accountAddress: moduleAddress, resourceType: "0x1::code::PackageRegistry" });
  const packageRecord = packageRegistry.packages.find((entry) => entry.name === "VeytosMarketplace");
  assert(packageRecord, "Published marketplace package missing from registry");

  const publicSteps = Object.fromEntries(Object.entries(journal.steps).map(([name, step]) => {
    const { signedBytes: _signedBytes, ...publicStep } = step;
    return [name, publicStep];
  }));
  const evidence = {
    network: "testnet",
    chainId: 2,
    verifiedAt: new Date().toISOString(),
    frameworkRevision: "831c39cff4c5a8ead98ddffe0edfc4ba51623e91",
    sdk: "7.3.0",
    sourceDigest,
    moduleAddress,
    roles,
    collectionAddress,
    tokenAddress,
    ownership: {
      before: roles.seller,
      firstEscrow: canonical(firstEscrow),
      afterCancel: roles.seller,
      secondEscrow: canonical(secondEscrow),
      afterBuy: roles.buyer,
    },
    listings: {
      first: { id: firstListingId, finalStatus: "CANCELLED" },
      second: { id: secondListingId, finalStatus: "SOLD" },
    },
    economics: {
      grossOctas: gross.toString(),
      platformFeeBps: "200",
      platformFeeOctas: expectedFee.toString(),
      royaltyNumerator: "750",
      royaltyDenominator: "10000",
      royaltyOctas: expectedRoyalty.toString(),
      sellerProceedsOctas: expectedSellerProceeds.toString(),
      buyerGrossGasChargeOctas: grossGasCharge.toString(),
      buyerStorageRefundOctas: storageRefund.toString(),
      buyerNetGasChargeOctas: netGasCharge.toString(),
      conserved: true,
    },
    package: {
      name: packageRecord.name,
      upgradePolicy: packageRecord.upgrade_policy,
      upgradeNumber: packageRecord.upgrade_number,
      sourceDigest: packageRecord.source_digest,
      deployedModules,
    },
    transactions: publicSteps,
    deploymentTransaction: publish.hash,
    listTransaction: firstList.hash,
    cancelTransaction: cancel.hash,
    relistTransaction: secondList.hash,
    buyTransaction: buy.hash,
    eventEvidence: {
      listed: [firstListed, secondListed],
      cancelled,
      purchased,
    },
    limitations: [
      "Testnet package uses compatible upgrades during development.",
      "No external audit has been completed.",
      "V2 admission still depends on documented capability-provenance review.",
      "No marketplace frontend action was implemented.",
    ],
  };
  await writeFile("docs/evidence/marketplace-v2-testnet.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log("Gate D-V2 marketplace acceptance verified. Evidence: docs/evidence/marketplace-v2-testnet.json");
} finally {
  await unlink(lockPath);
}
