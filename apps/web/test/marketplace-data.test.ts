import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(), collections: vi.fn(), inventory: vi.fn(),
  moduleAddress: `0x${'5'.repeat(64)}`, collectionAddress: `0x${'6'.repeat(64)}`,
  nativeCollectionAddress: `0x${'7'.repeat(64)}`,
}));
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/database', () => ({ database: () => ({ query: mocks.query }) }));
vi.mock('../src/lib/config', () => ({ network: 'testnet', marketplaceAddress: mocks.moduleAddress }));
vi.mock('../src/lib/chain', () => ({ aptos: {}, marketChain: vi.fn() }));
vi.mock('../src/lib/data', () => ({ discovery: vi.fn(async () => ({
  drops: [{
    address: `0x${'8'.repeat(64)}`, collection: mocks.nativeCollectionAddress, finalized: true,
    creator_paused: false, admin_paused: false, uploaded: '187', minted: '8',
    terms: { creator: `0x${'9'.repeat(64)}`, name: 'THE ORIGINALS', description: 'Native collection', collection_uri: 'ipfs://native', max_supply: '187', unit_price: '1', wallet_limit: '1', transaction_limit: '1', start_seconds: '0', end_seconds: '1', royalty_bps: '500', fee_bps: '0' },
  }], configured: true, errors: 0,
})) }));
vi.mock('@veytos/aptos/discovery', async (load) => {
  const actual = await load<typeof import('@veytos/aptos/discovery')>();
  return { ...actual, discoverCollectionsByIdentity: mocks.collections, discoverCollectionNFTs: mocks.inventory };
});
import { marketplaceCollections } from '../src/lib/marketplace-data';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collections.mockResolvedValue([]);
  mocks.inventory.mockRejectedValue(new Error('optional indexer unavailable'));
});

test('collection discovery derives only real fixed-price projection metrics', async () => {
  mocks.query.mockImplementation((sql: string) => {
    if (sql.includes('WITH collection_keys')) return Promise.resolve({ rows: [{
      collection_key: `v2:${mocks.collectionAddress}`, standard: 'v2', floor_price: '12000000', active_listings: '2',
      volume_24h: '30000000', sales_24h: '1', total_volume: '50000000', last_activity: '2026-10-04T00:00:00.000Z',
    }] });
    return Promise.resolve({ rows: [] });
  });
  const result = await marketplaceCollections({ sort: 'volume' });
  expect(result.items[0]).toMatchObject({ floorPrice: '12000000', activeListings: '2', volume24h: '30000000', sales24h: '1' });
  const sql = String(mocks.query.mock.calls[0]?.[0]);
  expect(sql).toContain("event_type='PURCHASED'");
  expect(sql).toContain("interval '24 hours'");
  expect(sql).toContain("status='ACTIVE'");
  expect(sql).not.toMatch(/offer|bid/i);
});

test('finalized launchpad collections appear before their first marketplace listing', async () => {
  mocks.query.mockResolvedValue({ rows: [] });
  const result = await marketplaceCollections({ sort: 'volume' });
  expect(result.items).toContainEqual(expect.objectContaining({
    key: `v2:${mocks.nativeCollectionAddress}`,
    name: 'THE ORIGINALS', native: true, floorPrice: null, activeListings: '0', volume24h: '0', supply: '8',
  }));
});
