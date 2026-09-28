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
import { chmod, cp, mkdir, open, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { TESTNET_FULLNODE, assertOutsideRepository, shouldResubmit, validateAcceptanceEnvironment } from "./lib/acceptance-config.js";

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
assert(accountStat.isFile());
assert.equal(accountStat.mode & 0o077, 0, "Testnet account file must have owner-only permissions");

const secrets = JSON.parse(await readFile(accountsPath, "utf8")) as Record<string, SecretRecord>;
if (!secrets.marketplaceV1BurnSafetyAdmin) {
  const generated = Account.generate();
  secrets.marketplaceV1BurnSafetyAdmin = {
    address: generated.accountAddress.toStringLong(),
    privateKey: generated.privateKey.toString(),
  };
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

const admin = load("marketplaceV1BurnSafetyAdmin");
const seller = load("marketplaceBuyer");
const buyer = load("buyer");
const treasury = load("marketplaceTreasury");
const royaltyRecipient = load("creator");
const roles = {
  admin: address(admin),
  seller: address(seller),
  buyer: address(buyer),
  treasury: address(treasury),
  royaltyRecipient: address(royaltyRecipient),
};
assert.equal(new Set(Object.values(roles)).size, 5, "Gate D-V1 roles must be independent");

const moduleAddress = roles.admin;
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const ledger = await aptos.getLedgerInfo();
assert.equal(ledger.chain_id, 2, "Wrong network");

const collectionName = "VEYTOS V1 Creator Burn Safety";
const tokenName = "Safe Legacy NFT #1";
const unsafeTokenName = "Creator Burnable Legacy NFT #1";
const nonzeroTokenName = "Nonzero Property Version Legacy NFT #1";
const propertyVersion = 0n;
async function aptBalance(account: Account, version?: string) {
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

async function tokenBalance(owner: string, name = tokenName, version = propertyVersion, ledgerVersion?: string) {
  const [value] = await aptos.view<[string]>({
    payload: {
      function: `${moduleAddress}::settlement_v1::token_balance`,
      functionArguments: [owner, roles.seller, collectionName, name, version.toString()],
    },
    ...(ledgerVersion ? { options: { ledgerVersion: BigInt(ledgerVersion) } } : {}),
  });
  return BigInt(value);
}

const sourceFiles = [
  "move/marketplace/Move.toml",
  ...(await readdir("move/marketplace/sources")).filter((file) => file.endsWith(".move")).sort()
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
  steps: Record<string, Step>;
};
const journalPath = ".testnet/marketplace-v1-creator-burn-journal.json";
let journal: Journal;
try {
  journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  journal = { sourceDigest, moduleAddress, roles, chainId: 2, steps: {} };
}
assert.equal(journal.sourceDigest, sourceDigest, "Marketplace source changed; start a new acceptance journal");
assert.equal(journal.moduleAddress, moduleAddress);
assert.deepEqual(journal.roles, roles);

async function saveJournal() {
  await writeFile(`${journalPath}.next`, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  await rename(`${journalPath}.next`, journalPath);
}

async function execute(name: string, signer: Account, build: () => Promise<SimpleTransaction>) {
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
      const body = await response.text();
      if (response.status === 400 && body.includes("TRANSACTION_EXPIRED")) {
        delete journal.steps[name];
        await saveJournal();
        return execute(name, signer, build);
      }
      throw new Error(`${name}: submission HTTP ${response.status}: ${body}; hash ${step.hash}`);
    }
  }
  const result = await aptos.waitForTransaction({
    transactionHash: step.hash,
    options: { checkSuccess: false, timeoutSecs: 60 },
  }) as UserTransactionResponse;
  assert.equal(result.type, "user_transaction");
  assert.equal(canonical(result.sender), address(signer));
  assert(result.success, `${name}: ${result.vm_status}`);
  Object.assign(step, {
    version: result.version,
    success: result.success,
    gasUsed: result.gas_used,
    gasUnitPrice: result.gas_unit_price,
    vmStatus: result.vm_status,
  });
  await saveJournal();
  console.log(`${name}: ${result.hash} (committed)`);
  return result;
}

const entry = (name: string, signer: Account, data: InputGenerateTransactionPayloadData) =>
  execute(name, signer, async () => {
    const transaction = await aptos.transaction.build.simple({
      sender: signer.accountAddress,
      data,
      options: { maxGasAmount: 100_000 },
    });
    const [simulation] = await aptos.transaction.simulate.simple({ signerPublicKey: signer.publicKey, transaction });
    assert(simulation?.success, `${name}: simulation failed: ${simulation?.vm_status}; nothing signed`);
    return transaction;
  });

async function expectListRejection(name: string, nameOfToken: string, version: bigint, expectedAbort: RegExp) {
  const [nextBefore] = await aptos.view<[string]>({
    payload: { function: `${moduleAddress}::marketplace::next_listing_id`, functionArguments: [] },
  });
  const balanceBefore = await tokenBalance(roles.seller, nameOfToken, version);
  const transaction = await aptos.transaction.build.simple({
    sender: seller.accountAddress,
    data: {
      function: `${moduleAddress}::settlement_v1::list`,
      functionArguments: [roles.seller, collectionName, nameOfToken, version.toString(), "10000000"],
    },
    options: { maxGasAmount: 100_000 },
  });
  const [simulation] = await aptos.transaction.simulate.simple({ signerPublicKey: seller.publicKey, transaction });
  assert(simulation && !simulation.success, `${name}: unsafe LIST simulation unexpectedly succeeded`);
  assert.match(simulation.vm_status, expectedAbort, `${name}: unexpected abort: ${simulation.vm_status}`);
  const [nextAfter] = await aptos.view<[string]>({
    payload: { function: `${moduleAddress}::marketplace::next_listing_id`, functionArguments: [] },
  });
  const balanceAfter = await tokenBalance(roles.seller, nameOfToken, version);
  assert.equal(balanceAfter, balanceBefore, `${name}: simulation changed seller custody`);
  assert.equal(nextAfter, nextBefore, `${name}: simulation changed marketplace state`);
  return {
    submitted: false,
    success: simulation.success,
    vmStatus: simulation.vm_status,
    gasUsed: simulation.gas_used,
    sellerBalanceBefore: balanceBefore.toString(),
    sellerBalanceAfter: balanceAfter.toString(),
    nextListingIdBefore: nextBefore,
    nextListingIdAfter: nextAfter,
  };
}

const feeStatement = (transaction: UserTransactionResponse) => {
  const statement = transaction.events.find((event) => event.type === "0x1::transaction_fee::FeeStatement");
  assert(statement, `FeeStatement missing from ${transaction.hash}`);
  return statement.data;
};

await mkdir(".testnet", { recursive: true, mode: 0o700 });
const lockPath = ".testnet/marketplace-v1-run.lock";
const lock = await open(lockPath, "wx", 0o600);
await lock.writeFile(String(process.pid));
await lock.close();

try {
  await entry("fund-v1-admin", buyer, {
    function: "0x1::aptos_account::transfer",
    functionArguments: [roles.admin, "180000000"],
  });

  const cli = process.env.APTOS_CLI || "aptos";
  const stagedPackage = ".testnet/marketplace-v1-package";
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
    ["marketplace.mv", "marketplace_fee_policy.mv", "settlement_v1.mv", "settlement_v2.mv"],
    "Publish production modules only",
  );
  const publish = await execute("publish", admin, async () => aptos.publishPackageTransaction({
    account: admin.accountAddress,
    metadataBytes: new Uint8Array(await readFile(`${buildRoot}/package-metadata.bcs`)),
    moduleBytecode: await Promise.all(modules.map(async (file) => new Uint8Array(
      await readFile(`${buildRoot}/bytecode_modules/${file}`),
    ))),
    options: { maxGasAmount: 500_000 },
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
    deployedModules.push({ name, sha256: createHash("sha256").update(local).digest("hex"), matchesPublished: true });
  }

  await entry("initialize-fee-policy", admin, {
    function: `${moduleAddress}::marketplace_fee_policy::initialize`, functionArguments: [roles.treasury],
  });
  await entry("initialize-marketplace", admin, {
    function: `${moduleAddress}::marketplace::initialize`, functionArguments: [],
  });
  await entry("initialize-v1", admin, {
    function: `${moduleAddress}::settlement_v1::initialize`, functionArguments: [],
  });
  await entry("create-v1-collection", seller, {
    function: "0x3::token::create_collection_script",
    functionArguments: [collectionName, "VEYTOS Token V1 creator-burn safety fixtures", "ipfs://veytos-v1-burn-safety", "10", [false, false, false]],
  });
  await entry("create-safe-v1-token", seller, {
    function: "0x3::token::create_token_script",
    functionArguments: [
      collectionName, tokenName, "Safe Token V1 marketplace fixture", "1", "1",
      "ipfs://veytos-v1-burn-safety/safe.json", roles.royaltyRecipient, "10000", "750",
      [false, false, false, false, true], [], [], [],
    ],
  });
  await entry("create-creator-burnable-v1-token", seller, {
    function: "0x3::token::create_token_script",
    functionArguments: [
      collectionName, unsafeTokenName, "Unsafe creator-burnable Token V1 fixture", "1", "1",
      "ipfs://veytos-v1-burn-safety/unsafe.json", roles.royaltyRecipient, "10000", "750",
      [false, false, false, false, false], ["TOKEN_BURNABLE_BY_CREATOR"], ["0x01"], ["bool"],
    ],
  });
  await entry("create-nonzero-version-v1-token", seller, {
    function: "0x3::token::create_token_script",
    functionArguments: [
      collectionName, nonzeroTokenName, "Nonzero property-version Token V1 fixture", "1", "1",
      "ipfs://veytos-v1-burn-safety/nonzero.json", roles.royaltyRecipient, "10000", "750",
      [false, false, false, false, true], [], [], [],
    ],
  });
  await entry("mutate-nonzero-fixture-to-property-version-one", seller, {
    function: "0x3::token::mutate_token_properties",
    functionArguments: [roles.seller, roles.seller, collectionName, nonzeroTokenName, "0", "1", [], [], []],
  });
  assert.equal(await tokenBalance(roles.seller), 1n, "Seller must own the safe version-zero asset");
  assert.equal(await tokenBalance(roles.seller, unsafeTokenName, 0n), 1n, "Seller must own the unsafe fixture before rejection");
  assert.equal(await tokenBalance(roles.seller, nonzeroTokenName, 1n), 1n, "Seller must own the nonzero-version fixture before rejection");

  const unsafeRejection = await expectListRejection(
    "creator-burnable-version-zero",
    unsafeTokenName,
    0n,
    /ECREATOR_BURNABLE|0x9\b/i,
  );
  const nonzeroRejection = await expectListRejection(
    "nonzero-property-version",
    nonzeroTokenName,
    1n,
    /EUNSUPPORTED_PROPERTY_VERSION|0xa\b/i,
  );

  const gross = 10_000_000n;
  const expectedFee = 200_000n;
  const expectedRoyalty = 750_000n;
  const expectedSellerProceeds = 9_050_000n;
  assert.equal(gross, expectedFee + expectedRoyalty + expectedSellerProceeds);

  const listArgs = [roles.seller, collectionName, tokenName, propertyVersion.toString(), gross.toString()];
  const firstList = await entry("list-first", seller, {
    function: `${moduleAddress}::settlement_v1::list`, functionArguments: listArgs,
  });
  const firstListed = firstList.events.find((event) => event.type.endsWith("::marketplace::NFTListed"));
  assert(firstListed, "First NFTListed missing");
  const firstListingId = String(firstListed.data.listing_id);
  assert.equal(firstListed.data.storage_reimbursement, "0");
  assert.equal(firstListed.data.royalty_numerator, "750");
  assert.equal(firstListed.data.royalty_denominator, "10000");
  assert.equal(await tokenBalance(roles.seller, tokenName, propertyVersion, firstList.version), 0n);
  const [firstEscrow] = await aptos.view<[boolean]>({
    payload: { function: `${moduleAddress}::settlement_v1::has_escrow`, functionArguments: [firstListingId] },
    options: { ledgerVersion: BigInt(firstList.version) },
  });
  assert(firstEscrow);

  const cancel = await entry("cancel-first", seller, {
    function: `${moduleAddress}::settlement_v1::cancel`, functionArguments: [firstListingId],
  });
  assert.equal(await tokenBalance(roles.seller, tokenName, propertyVersion, cancel.version), 1n);
  const refund = BigInt(feeStatement(cancel).storage_fee_refund_octas);
  assert(refund > 0n && refund <= 10_000_000n, `Invalid measured V1 refund: ${refund}`);
  const [firstStatus] = await aptos.view<[number]>({
    payload: { function: `${moduleAddress}::marketplace::listing_status`, functionArguments: [firstListingId] },
  });
  assert.equal(firstStatus, 2);

  await entry("configure-v1-storage-reimbursement", admin, {
    function: `${moduleAddress}::marketplace_fee_policy::set_v1_storage_reimbursement`,
    functionArguments: [refund.toString()],
  });
  const secondList = await entry("list-second", seller, {
    function: `${moduleAddress}::settlement_v1::list`, functionArguments: listArgs,
  });
  const secondListed = secondList.events.find((event) => event.type.endsWith("::marketplace::NFTListed"));
  assert(secondListed, "Second NFTListed missing");
  const secondListingId = String(secondListed.data.listing_id);
  assert.equal(secondListed.data.storage_reimbursement, refund.toString());
  assert.notEqual(secondListingId, firstListingId);
  assert.equal(await tokenBalance(roles.seller, tokenName, propertyVersion, secondList.version), 0n);

  const beforeBuy = await Promise.all([
    aptBalance(buyer, secondList.version), aptBalance(seller, secondList.version),
    aptBalance(treasury, secondList.version), aptBalance(royaltyRecipient, secondList.version),
  ]);
  const buy = await entry("buy-second", buyer, {
    function: `${moduleAddress}::settlement_v1::buy`,
    functionArguments: [secondListingId, gross.toString(), refund.toString()],
  });
  const afterBuy = await Promise.all([
    aptBalance(buyer, buy.version), aptBalance(seller, buy.version),
    aptBalance(treasury, buy.version), aptBalance(royaltyRecipient, buy.version),
  ]);
  const buyFeeStatement = feeStatement(buy);
  const grossGasCharge = BigInt(buy.gas_used) * BigInt(buy.gas_unit_price);
  const buyStorageRefund = BigInt(buyFeeStatement.storage_fee_refund_octas);
  const netGasCharge = grossGasCharge - buyStorageRefund;
  assert.equal(beforeBuy[0]! - afterBuy[0]!, gross + refund + netGasCharge);
  assert.equal(afterBuy[1]! - beforeBuy[1]!, expectedSellerProceeds + refund);
  assert.equal(afterBuy[2]! - beforeBuy[2]!, expectedFee);
  assert.equal(afterBuy[3]! - beforeBuy[3]!, expectedRoyalty);
  assert.equal(await tokenBalance(roles.buyer, tokenName, propertyVersion, buy.version), 1n);
  assert.equal(await tokenBalance(roles.seller, tokenName, propertyVersion, buy.version), 0n);
  const [secondStatus] = await aptos.view<[number]>({
    payload: { function: `${moduleAddress}::marketplace::listing_status`, functionArguments: [secondListingId] },
  });
  assert.equal(secondStatus, 3);

  const purchased = buy.events.find((event) => event.type.endsWith("::marketplace::NFTPurchased"));
  assert(purchased, "NFTPurchased missing");
  assert.equal(purchased.data.platform_fee, expectedFee.toString());
  assert.equal(purchased.data.royalty, expectedRoyalty.toString());
  assert.equal(purchased.data.seller_proceeds, expectedSellerProceeds.toString());
  assert.equal(purchased.data.storage_reimbursement, refund.toString());

  const packageRegistry = await aptos.getAccountResource<{
    packages: { name: string; upgrade_policy: { policy: number }; upgrade_number: string; source_digest: string }[];
  }>({ accountAddress: moduleAddress, resourceType: "0x1::code::PackageRegistry" });
  const packageRecord = packageRegistry.packages.find((entry) => entry.name === "VeytosMarketplace");
  assert(packageRecord);
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
    asset: { standard: "TOKEN_V1", creator: roles.seller, collectionName, tokenName, propertyVersion: "0" },
    rejectedAssets: {
      creatorBurnableVersionZero: {
        creator: roles.seller, collectionName, tokenName: unsafeTokenName, propertyVersion: "0", ...unsafeRejection,
      },
      nonzeroPropertyVersion: {
        creator: roles.seller, collectionName, tokenName: nonzeroTokenName, propertyVersion: "1", ...nonzeroRejection,
      },
    },
    ownership: {
      before: roles.seller,
      duringEscrow: { modulePrivateLinearCustody: true },
      afterCancel: roles.seller,
      afterBuy: roles.buyer,
    },
    listings: {
      first: { id: firstListingId, finalStatus: "CANCELLED" },
      second: { id: secondListingId, finalStatus: "SOLD" },
    },
    economics: {
      grossOctas: gross.toString(), platformFeeBps: "200", platformFeeOctas: expectedFee.toString(),
      royaltyNumerator: "750", royaltyDenominator: "10000", royaltyOctas: expectedRoyalty.toString(),
      sellerProceedsOctas: expectedSellerProceeds.toString(), storageReimbursementOctas: refund.toString(),
      buyerGrossGasChargeOctas: grossGasCharge.toString(), buyerStorageRefundOctas: buyStorageRefund.toString(),
      buyerNetGasChargeOctas: netGasCharge.toString(), conserved: true,
    },
    storageEconomics: {
      firstList: feeStatement(firstList), cancel: feeStatement(cancel), secondList: feeStatement(secondList), buy: buyFeeStatement,
    },
    package: {
      name: packageRecord.name, upgradePolicy: packageRecord.upgrade_policy,
      upgradeNumber: packageRecord.upgrade_number, sourceDigest: packageRecord.source_digest, deployedModules,
    },
    transactions: publicSteps,
    deploymentTransaction: publish.hash,
    listTransaction: firstList.hash,
    cancelTransaction: cancel.hash,
    relistTransaction: secondList.hash,
    buyTransaction: buy.hash,
    eventEvidence: {
      listed: [firstListed, secondListed],
      cancelled: cancel.events.find((event) => event.type.endsWith("::marketplace::ListingCancelled")),
      purchased,
    },
    limitations: [
      "Testnet package uses compatible upgrades during development.",
      "Representative Token V1 assets were constructed on testnet; no valuable mainnet NFT was transacted.",
      "Unsafe LIST evidence is a fullnode simulation that was never signed or submitted; unchanged balance and next-listing-id reads demonstrate no custody or marketplace state change.",
      "No external audit has been completed.",
      "No marketplace frontend action was implemented.",
    ],
  };
  await writeFile("docs/evidence/marketplace-v1-creator-burn-remediation-testnet.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log("V1 creator-burn remediation verified. Evidence: docs/evidence/marketplace-v1-creator-burn-remediation-testnet.json");
} finally {
  await unlink(lockPath);
}
