import { Account, AccountAddress, Aptos, AptosConfig, Ed25519PrivateKey, Network, generateSignedTransaction, generateUserTransactionHash, type InputGenerateTransactionPayloadData, type UserTransactionResponse } from '@aptos-labs/ts-sdk';
import { CID } from 'multiformats/cid';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { validateManifest } from '../packages/domain/src/metadata.ts';

const SUPPLY = 187;
const COLLECTION = process.env.VEYTOS_DROP_COLLECTION || 'THE ORIGINALS';
const SPECIES = process.env.VEYTOS_DROP_SPECIES || 'Binturong';
const DESCRIPTION = process.env.VEYTOS_DROP_DESCRIPTION || `${COLLECTION} is a collection of ${SUPPLY} unique ${SPECIES} NFTs on Aptos testnet.`;
const PRICE_OCTAS = '100000000';
const WALLET_LIMIT = '10';
const TRANSACTION_LIMIT = '5';
const ROYALTY_BPS = '750';
const EXPECTED_FEE_BPS = '500';
const DROP_ID = new TextEncoder().encode(process.env.VEYTOS_DROP_ID || 'the-originals-187-v1');
const MODULE = AccountAddress.from(process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS || '0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28').toStringLong();
const MARKETPLACE = AccountAddress.from(process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || '0x6402e274769885692940cf139d8ee9978d79192e3315e2088fd586c2d9173f91').toStringLong();
const USER_HOME = homedir();
const INPUT = resolve(process.env.ORIGINALS_IMAGE_DIR || resolve(USER_HOME, 'Downloads/COMMON #001–#360'));
const COVER_IMAGE = process.env.VEYTOS_DROP_COVER_IMAGE ? resolve(process.env.VEYTOS_DROP_COVER_IMAGE) : null;
const SOURCE_IMAGE_JOURNAL = process.env.VEYTOS_DROP_SOURCE_IMAGE_JOURNAL ? resolve(process.env.VEYTOS_DROP_SOURCE_IMAGE_JOURNAL) : null;
const SOURCE_ASSET_JOURNAL = process.env.VEYTOS_DROP_SOURCE_ASSET_JOURNAL ? resolve(process.env.VEYTOS_DROP_SOURCE_ASSET_JOURNAL) : null;
const API_KEY_FILE = resolve(process.env.LIGHTHOUSE_API_KEY_FILE || resolve(USER_HOME, 'Downloads/Apikey.txt'));
const ACCOUNTS_FILE = resolve(process.env.MINTOS_TESTNET_ACCOUNTS_FILE || resolve(USER_HOME, '.local/share/mintos/testnet/accounts.json'));
const OUTPUT_DIR = resolve(process.env.VEYTOS_DROP_OUTPUT_DIR || '.testnet/originals');
const JOURNAL_FILE = `${OUTPUT_DIR}/journal.json`;
const MANIFEST_FILE = `${OUTPUT_DIR}/manifest.json`;
const LIGHTHOUSE_UPLOAD = 'https://upload.lighthouse.storage/api/v0/add';
const FULLNODE = (process.env.APTOS_FULLNODE_URL || 'https://api.testnet.aptoslabs.com/v1').replace(/\/$/, '');
assert(['https://api.testnet.aptoslabs.com/v1', 'https://fullnode.testnet.aptoslabs.com/v1'].includes(FULLNODE), 'Use an official Aptos testnet fullnode');
const aptosApiKey = process.env.APTOS_API_KEY;
const aptosAuthHeaders = aptosApiKey ? { Authorization: `Bearer ${aptosApiKey}` } : {};

type Upload = { cid: string; size: number };
type Step = { hash: string; signedBytes: string; version?: string; success?: boolean; vmStatus?: string };
type Journal = {
  version: 1;
  module: string;
  creator: string;
  images: Record<string, Upload>;
  metadata: Record<string, Upload>;
  cover?: Upload;
  collection?: Upload;
  drop?: string;
  collectionAddress?: string;
  steps: Record<string, Step>;
};

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET, fullnode: FULLNODE, ...(aptosApiKey ? { fullnodeConfig: { HEADERS: aptosAuthHeaders } } : {}) }));
const imagePath = (id: number) => `${INPUT}/THE ORIGINALS #${String(id).padStart(3, '0')}.png`;
const tokenName = (id: number) => `${COLLECTION} #${String(id).padStart(3, '0')}`;
const canonical = (value: string) => AccountAddress.from(value).toStringLong();
const fn = (name: string) => `${MODULE}::launchpad::${name}` as `${string}::${string}::${string}`;
const marketplaceFn = (module: string, name: string) => `${MARKETPLACE}::${module}::${name}` as `${string}::${string}::${string}`;

async function save(journal: Journal) {
  const next = `${JOURNAL_FILE}.next`;
  await writeFile(next, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  await rename(next, JOURNAL_FILE);
}

async function loadJournal(creator: string): Promise<Journal> {
  try {
    const value = JSON.parse(await readFile(JOURNAL_FILE, 'utf8')) as Journal;
    assert.equal(value.version, 1);
    assert.equal(canonical(value.module), MODULE);
    assert.equal(canonical(value.creator), creator);
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (SOURCE_ASSET_JOURNAL) {
      const source = JSON.parse(await readFile(SOURCE_ASSET_JOURNAL, 'utf8')) as Journal;
      assert.equal(Object.keys(source.images || {}).length, SUPPLY, `Source asset journal must contain exactly ${SUPPLY} images`);
      assert.equal(Object.keys(source.metadata || {}).length, SUPPLY, `Source asset journal must contain exactly ${SUPPLY} metadata objects`);
      for (const upload of [...Object.values(source.images), ...Object.values(source.metadata)]) CID.parse(upload.cid);
      if (source.cover) CID.parse(source.cover.cid);
      if (source.collection) CID.parse(source.collection.cid);
      assert(source.collection, 'Source asset journal must contain collection metadata');
      return {
        version: 1,
        module: MODULE,
        creator,
        images: structuredClone(source.images),
        metadata: structuredClone(source.metadata),
        ...(source.cover ? { cover: structuredClone(source.cover) } : {}),
        collection: structuredClone(source.collection),
        steps: {},
      };
    }
    let images: Record<string, Upload> = {};
    if (SOURCE_IMAGE_JOURNAL) {
      const source = JSON.parse(await readFile(SOURCE_IMAGE_JOURNAL, 'utf8')) as Pick<Journal, 'images'>;
      assert.equal(Object.keys(source.images || {}).length, SUPPLY, `Source image journal must contain exactly ${SUPPLY} images`);
      for (const upload of Object.values(source.images)) CID.parse(upload.cid);
      images = structuredClone(source.images);
    }
    return { version: 1, module: MODULE, creator, images, metadata: {}, steps: {} };
  }
}

async function upload(bytes: Uint8Array, name: string, contentType: string, apiKey: string): Promise<Upload> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const form = new FormData();
      const blobBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      form.append('file', new Blob([blobBody], { type: contentType }), name);
      const response = await fetch(LIGHTHOUSE_UPLOAD, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(180_000) });
      if (!response.ok) {
        const detail = await response.text();
        if (response.status < 500 && response.status !== 429) throw new Error(`Lighthouse upload failed for ${name}: HTTP ${response.status} ${detail}`);
        throw new Error(`Lighthouse transient response for ${name}: HTTP ${response.status} ${detail}`);
      }
      const body = await response.json() as { Hash?: string; Size?: string | number; data?: { Hash?: string; Size?: string | number } };
      const cid = body.data?.Hash || body.Hash;
      const size = Number(body.data?.Size || body.Size || bytes.byteLength);
      assert(cid, `Lighthouse did not return a CID for ${name}`);
      CID.parse(cid);
      return { cid, size };
    } catch (error) {
      lastError = error;
      if (attempt === 5 || error instanceof Error && error.message.includes('upload failed')) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function mapLimit<T>(values: T[], limit: number, task: (value: T) => Promise<void>, afterBatch: () => Promise<void>) {
  for (let offset = 0; offset < values.length; offset += limit) {
    await Promise.all(values.slice(offset, offset + limit).map(task));
    await afterBatch();
  }
}

async function execute(journal: Journal, name: string, signer: Account, data: InputGenerateTransactionPayloadData) {
  let step = journal.steps[name];
  if (!step) {
    const transaction = await aptos.transaction.build.simple({ sender: signer.accountAddress, data, options: { maxGasAmount: 500_000 } });
    const [simulation] = await aptos.transaction.simulate.simple({ signerPublicKey: signer.publicKey, transaction });
    assert(simulation?.success, `${name} simulation failed: ${simulation?.vm_status}`);
    const senderAuthenticator = aptos.transaction.sign({ signer, transaction });
    const input = { transaction, senderAuthenticator };
    step = { hash: generateUserTransactionHash(input), signedBytes: Buffer.from(generateSignedTransaction(input)).toString('hex') };
    journal.steps[name] = step;
    await save(journal);
  }
  const lookup = await fetch(`${FULLNODE}/transactions/by_hash/${step.hash}`, { headers: aptosAuthHeaders });
  if (lookup.status === 404) {
    const response = await fetch(`${FULLNODE}/transactions`, { method: 'POST', headers: { 'content-type': 'application/x.aptos.signed_transaction+bcs', ...aptosAuthHeaders }, body: Buffer.from(step.signedBytes, 'hex') });
    if (!response.ok) throw new Error(`${name} submission failed: HTTP ${response.status} ${await response.text()}; saved hash ${step.hash}`);
  } else if (!lookup.ok) throw new Error(`${name} lookup failed: HTTP ${lookup.status}; reconcile before retrying`);
  const result = await aptos.waitForTransaction({ transactionHash: step.hash, options: { checkSuccess: false, timeoutSecs: 60 } }) as UserTransactionResponse;
  assert.equal(result.hash, step.hash);
  assert.equal(canonical(result.sender), canonical(signer.accountAddress.toStringLong()));
  step.version = result.version;
  step.success = result.success;
  step.vmStatus = result.vm_status;
  await save(journal);
  assert(result.success, `${name} failed: ${result.vm_status}`);
  console.log(`${name}: ${step.hash}`);
  return result;
}

await mkdir(OUTPUT_DIR, { recursive: true, mode: 0o700 });
assert.equal((await stat(API_KEY_FILE)).isFile(), true, 'Lighthouse API key file is missing');
const apiKey = (await readFile(API_KEY_FILE, 'utf8')).trim();
assert(/^[A-Za-z0-9._-]{20,}$/.test(apiKey), 'Unexpected Lighthouse API key format');
const secrets = JSON.parse(await readFile(ACCOUNTS_FILE, 'utf8')) as Record<string, { address: string; privateKey: string }>;
assert(secrets.creator, 'Creator account is missing');
const creator = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(secrets.creator.privateKey) });
const creatorAddress = creator.accountAddress.toStringLong();
assert.equal(creatorAddress, canonical(secrets.creator.address), 'Creator address/key mismatch');
const ledger = await aptos.getLedgerInfo();
assert.equal(ledger.chain_id, 2, 'This script is testnet-only');
const [configuration] = await Promise.all([
  aptos.view<[string, string, boolean, string]>({ payload: { function: `${MODULE}::fee_policy::configuration`, functionArguments: [] } }),
  ...Array.from({ length: SUPPLY }, (_, index) => stat(imagePath(index + 1)).then((value) => assert(value.isFile(), `${basename(imagePath(index + 1))} is not a file`))),
]);
assert.equal(configuration[0], EXPECTED_FEE_BPS, 'Launchpad fee changed');
assert.equal(configuration[2], false, 'Launchpad is paused');
const journal = await loadJournal(creatorAddress);

const ids = Array.from({ length: SUPPLY }, (_, index) => index + 1);
const missingImages = ids.filter((id) => !journal.images[String(id)]);
await mapLimit(missingImages, 4, async (id) => {
  const bytes = new Uint8Array(await readFile(imagePath(id)));
  journal.images[String(id)] = await upload(bytes, `${String(id).padStart(3, '0')}.png`, 'image/png', apiKey);
  console.log(`image ${id}/${SUPPLY}: ${journal.images[String(id)]!.cid}`);
}, async () => save(journal));

const metadataFor = (id: number) => ({
  name: tokenName(id),
  description: `${tokenName(id)} — a ${SPECIES} from the ${COLLECTION} collection.`,
  image: `ipfs://${journal.images[String(id)]!.cid}`,
  attributes: [
    { trait_type: 'Species', value: SPECIES },
    { trait_type: 'Serial', value: id },
  ],
});
const missingMetadata = ids.filter((id) => !journal.metadata[String(id)]);
await mapLimit(missingMetadata, 8, async (id) => {
  const bytes = new TextEncoder().encode(JSON.stringify(metadataFor(id)));
  journal.metadata[String(id)] = await upload(bytes, `${String(id).padStart(3, '0')}.json`, 'application/json', apiKey);
  console.log(`metadata ${id}/${SUPPLY}: ${journal.metadata[String(id)]!.cid}`);
}, async () => save(journal));

if (COVER_IMAGE && !journal.cover) {
  const coverBytes = new Uint8Array(await readFile(COVER_IMAGE));
  assert.equal((await stat(COVER_IMAGE)).isFile(), true, 'Collection cover is not a file');
  assert(['GIF87a', 'GIF89a'].includes(Buffer.from(coverBytes.subarray(0, 6)).toString('ascii')), 'Collection cover must be a GIF');
  journal.cover = await upload(coverBytes, basename(COVER_IMAGE), 'image/gif', apiKey);
  await save(journal);
  console.log(`collection cover: ${journal.cover.cid}`);
}

if (!journal.collection) {
  const collectionMetadata = { name: COLLECTION, description: DESCRIPTION, image: `ipfs://${journal.cover?.cid || journal.images['1']!.cid}`, external_url: 'https://veytos.com', attributes: [{ trait_type: 'Species', value: SPECIES }] };
  journal.collection = await upload(new TextEncoder().encode(JSON.stringify(collectionMetadata)), 'collection.json', 'application/json', apiKey);
  await save(journal);
  console.log(`collection metadata: ${journal.collection.cid}`);
}

const manifest = validateManifest({ version: 1, tokens: ids.map((id) => ({ id, metadataUri: `ipfs://${journal.metadata[String(id)]!.cid}`, metadata: metadataFor(id) })) }, SUPPLY);
await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

const freshLedger = await aptos.getLedgerInfo();
const start = (BigInt(freshLedger.ledger_timestamp) / 1_000_000n + 60n).toString();
await execute(journal, 'prepare', creator, { function: fn('prepare_drop'), functionArguments: [DROP_ID, COLLECTION, DESCRIPTION, `ipfs://${journal.collection.cid}`, String(SUPPLY), PRICE_OCTAS, WALLET_LIMIT, TRANSACTION_LIMIT, start, '0', ROYALTY_BPS, EXPECTED_FEE_BPS] });
const [drop] = await aptos.view<[string]>({ payload: { function: fn('drop_address'), functionArguments: [creatorAddress, DROP_ID] } });
journal.drop = canonical(drop);
await save(journal);
for (let offset = 0; offset < SUPPLY; offset += 25) {
  const chunk = manifest.tokens.slice(offset, offset + 25);
  await execute(journal, `metadata-${offset}`, creator, { function: fn('append_metadata'), functionArguments: [journal.drop, String(offset), chunk.map((token) => token.metadata.name), chunk.map((token) => token.metadataUri)] });
}
await execute(journal, 'finalize', creator, { function: fn('finalize_drop'), functionArguments: [journal.drop, EXPECTED_FEE_BPS] });
const [state] = await aptos.view<[{ finalized: boolean; uploaded: string; minted: string; collection: string; terms: { name: string; max_supply: string; unit_price: string; collection_uri: string } }]>({ payload: { function: fn('get_drop'), functionArguments: [journal.drop] } });
assert.equal(state.finalized, true);
assert.equal(state.uploaded, String(SUPPLY));
assert.equal(state.terms.name, COLLECTION);
assert.equal(state.terms.max_supply, String(SUPPLY));
assert.equal(state.terms.unit_price, PRICE_OCTAS);
assert.equal(state.terms.collection_uri, `ipfs://${journal.collection.cid}`);
journal.collectionAddress = canonical(state.collection);
await save(journal);
const [, , , , , configuredMarketplaceAdmin] = await aptos.view<[string, string, boolean, boolean, boolean, string]>({
  payload: { function: marketplaceFn('marketplace_fee_policy', 'configuration'), functionArguments: [] },
});
const marketplaceAdminAddress = canonical(configuredMarketplaceAdmin);
const marketplaceAdminRecord = Object.values(secrets).find((record) => canonical(record.address) === marketplaceAdminAddress);
assert(marketplaceAdminRecord, `Marketplace admin ${marketplaceAdminAddress} is unavailable in the protected testnet account file`);
const marketplaceAdmin = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(marketplaceAdminRecord.privateKey) });
const [reviewed] = await aptos.view<[boolean, number]>({
  payload: { function: marketplaceFn('marketplace', 'v2_collection_policy'), functionArguments: [journal.collectionAddress] },
});
if (!reviewed) {
  await execute(journal, 'marketplace-admission', marketplaceAdmin, {
    function: marketplaceFn('marketplace', 'set_v2_collection_reviewed'),
    functionArguments: [journal.collectionAddress, 1, true],
  });
}
const policy = await aptos.view<[boolean, number]>({
  payload: { function: marketplaceFn('marketplace', 'v2_collection_policy'), functionArguments: [journal.collectionAddress] },
});
assert.deepEqual(policy, [true, 1], 'Finalized VEYTOS collection was not admitted to the marketplace');
console.log(JSON.stringify({ drop: journal.drop, collection: journal.collectionAddress, collectionMetadata: state.terms.collection_uri, supply: state.terms.max_supply, priceOctas: state.terms.unit_price }, null, 2));
