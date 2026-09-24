import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAptos } from '../src/client.ts';
import { discoverOwnedNFTs, NFTDiscoveryError, normalizeOwnershipRows } from '../src/discovery.ts';

const a = (digit: string) => `0x${digit.repeat(64)}`;
const owner = a('1');
const v1Collection = a('2');
const v1Token = a('3');
const v1Creator = a('4');
const v2Collection = a('5');
const v2Token = a('6');

type IndexerRow = Awaited<ReturnType<ReturnType<typeof makeAptos>['getAccountOwnedTokens']>>[number];
function row(standard: 'v1' | 'v2', overrides: Partial<IndexerRow> = {}): IndexerRow {
  const isV1 = standard === 'v1';
  return {
    token_standard: standard,
    token_properties_mutated_v1: null,
    token_data_id: isV1 ? v1Token : v2Token,
    table_type_v1: isV1 ? '0x3::token::TokenStore' : null,
    storage_id: a('7'),
    property_version_v1: 0,
    owner_address: owner,
    last_transaction_version: 20,
    last_transaction_timestamp: '2026-09-24T00:00:00',
    is_soulbound_v2: false,
    is_fungible_v2: false,
    amount: 1,
    current_token_data: {
      collection_id: isV1 ? v1Collection : v2Collection,
      description: isV1 ? 'Historical token' : 'Object token',
      is_fungible_v2: false,
      largest_property_version_v1: isV1 ? 0 : null,
      last_transaction_timestamp: '2026-09-24T00:00:00',
      last_transaction_version: 20,
      maximum: 1,
      supply: 1,
      token_data_id: isV1 ? v1Token : v2Token,
      token_name: isV1 ? 'OG #1' : 'DA #1',
      token_properties: {},
      token_standard: standard,
      token_uri: isV1 ? 'ipfs://legacy' : 'ipfs://digital-asset',
      decimals: 0,
      current_collection: {
        collection_id: isV1 ? v1Collection : v2Collection,
        collection_name: isV1 ? 'OG Collection' : 'DA Collection',
        creator_address: v1Creator,
        current_supply: 1,
        description: 'Collection',
        last_transaction_timestamp: '2026-09-24T00:00:00',
        last_transaction_version: 10,
        max_supply: 100,
        mutable_description: false,
        mutable_uri: false,
        table_handle_v1: isV1 ? a('8') : null,
        token_standard: standard,
        total_minted_v2: isV1 ? null : 1,
        uri: 'ipfs://collection',
      },
    },
    ...overrides,
  };
}

afterEach(() => mock.restoreAll());

test('normalizes V1 identity without pretending it is an object', () => {
  const result = normalizeOwnershipRows([row('v1')]);
  assert.equal(result.rejectedRows, 0);
  assert.deepEqual(result.items[0]?.identity, {
    standard: 'v1', creator: v1Creator, collection: 'OG Collection', name: 'OG #1', propertyVersion: '0',
  });
  assert.equal(result.items[0]?.collectionId, v1Collection);
  assert.equal(result.items[0]?.image, null);
});

test('normalizes V2 token and collection object identities', () => {
  const result = normalizeOwnershipRows([row('v2')]);
  assert.deepEqual(result.items[0]?.identity, { standard: 'v2', address: v2Token });
  assert.equal(result.items[0]?.collectionId, v2Collection);
  assert.equal(result.items[0]?.standard, 'v2');
});

test('missing and malformed metadata rows are rejected rather than guessed', () => {
  const missing = { ...row('v1'), current_token_data: null };
  const malformed = { ...row('v2'), token_data_id: 'not-an-address' };
  const result = normalizeOwnershipRows([missing, malformed]);
  assert.deepEqual(result.items, []);
  assert.equal(result.rejectedRows, 2);
});

test('duplicate ownership entries keep the latest authoritative row', () => {
  const result = normalizeOwnershipRows([
    row('v1', { last_transaction_version: 10, amount: 1 }),
    row('v1', { last_transaction_version: 30, amount: 2 }),
  ]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.amount, '2');
  assert.equal(result.items[0]?.lastTransactionVersion, '30');
});

test('a newer zero balance suppresses a stale positive ownership row', () => {
  const result = normalizeOwnershipRows([
    row('v2', { last_transaction_version: 10, amount: 1 }),
    row('v2', { last_transaction_version: 40, amount: 0 }),
  ]);
  assert.deepEqual(result.items, []);
});

test('rows for another owner are rejected instead of leaking into the wallet result', () => {
  const result = normalizeOwnershipRows([row('v2', { owner_address: a('9') })], owner);
  assert.deepEqual(result.items, []);
  assert.equal(result.rejectedRows, 1);
});

test('empty wallets return an empty, successful discovery result', async () => {
  const aptos = makeAptos('mainnet');
  mock.method(aptos, 'getAccountOwnedTokens', async () => []);
  assert.deepEqual(await discoverOwnedNFTs(aptos, owner), { items: [], rejectedRows: 0, pages: 0 });
});

test('paginates, deduplicates page boundaries, and stops on a short page', async () => {
  const aptos = makeAptos('mainnet');
  const calls: number[] = [];
  mock.method(aptos, 'getAccountOwnedTokens', async ({ options }: Parameters<typeof aptos.getAccountOwnedTokens>[0]) => {
    calls.push(Number(options?.offset ?? -1));
    if (options?.offset === 0) return [row('v1'), row('v2')];
    if (options?.offset === 2) return [row('v2', { last_transaction_version: 21 })];
    return [];
  });
  const result = await discoverOwnedNFTs(aptos, owner, { pageSize: 2 });
  assert.deepEqual(calls, [0, 2]);
  assert.equal(result.pages, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0]?.lastTransactionVersion, '21');
});

test('Indexer and GraphQL failures are mapped to a stable discovery error', async () => {
  for (const cause of [new Error('HTTP 503'), new Error('GraphQL errors: permission denied')]) {
    const aptos = makeAptos('mainnet');
    mock.method(aptos, 'getAccountOwnedTokens', async () => { throw cause; });
    await assert.rejects(discoverOwnedNFTs(aptos, owner), (error) =>
      error instanceof NFTDiscoveryError && error.code === 'indexer-unavailable' && error.cause === cause);
  }
});

test('pagination bounds fail closed instead of returning a silent partial wallet', async () => {
  const aptos = makeAptos('mainnet');
  mock.method(aptos, 'getAccountOwnedTokens', async () => [row('v1')]);
  await assert.rejects(discoverOwnedNFTs(aptos, owner, { pageSize: 1, maxPages: 1 }), (error) =>
    error instanceof NFTDiscoveryError && error.code === 'pagination-limit');
});
