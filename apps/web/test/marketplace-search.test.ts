import { expect, test } from 'vitest';
import type { MarketplaceCollectionSummary } from '../src/lib/marketplace-data';
import type { Drop } from '@veytos/aptos/types';
import { searchLaunchpadDrops, searchMarketplaceCollections } from '../src/lib/marketplace-search';

function collection(overrides: Partial<MarketplaceCollectionSummary>): MarketplaceCollectionSummary {
  return {
    key: 'v2:0x1', standard: 'v2', name: 'Collection', creator: '0x1', description: '', metadataUri: '', bannerUri: null,
    creatorName: null, verified: false, native: false, floorPrice: null, floor24hAgo: null, activeListings: '0', volume24h: '0',
    sales24h: '0', totalVolume: '0', supply: null, lastActivity: null, links: {}, ...overrides,
  };
}

test('search ranks exact names ahead of prefix and substring matches', () => {
  const results = searchMarketplaceCollections([
    collection({ key: 'v2:0x1', name: 'Rare Mintera Club' }),
    collection({ key: 'v2:0x2', name: 'Mintera Originals' }),
    collection({ key: 'v2:0x3', name: 'Mintera' }),
  ], '  MINTERA ');
  expect(results.map((result) => result.name)).toEqual(['Mintera', 'Mintera Originals', 'Rare Mintera Club']);
});

test('search matches creator display names, addresses, and collection keys', () => {
  const creator = collection({ key: 'v2:0xaaa', name: 'Creator match', creator: '0xbeef', creatorName: 'Studio North' });
  const address = collection({ key: 'v2:0xcafe', name: 'Address match', creator: '0xcafe' });
  expect(searchMarketplaceCollections([creator, address], 'studio')).toHaveLength(1);
  expect(searchMarketplaceCollections([creator, address], '0xcafe')[0]?.name).toBe('Address match');
});

test('search ignores one-character input and respects the result limit', () => {
  const items = Array.from({ length: 10 }, (_, index) => collection({ key: `v2:0x${index}`, name: `Mint ${index}` }));
  expect(searchMarketplaceCollections(items, 'm')).toEqual([]);
  expect(searchMarketplaceCollections(items, 'mint', 4)).toHaveLength(4);
});

test('Launchpad search matches drop names, drop addresses, collection addresses, and creators', () => {
  const drop: Drop = {
    address: '0xdrop123', collection: '0xcollection456', finalized: true, creator_paused: false, admin_paused: false,
    uploaded: '10', minted: '4', terms: { creator: '0xcreator789', name: 'Mintera Drop', description: '', collection_uri: '', max_supply: '10', unit_price: '100000000', wallet_limit: '2', transaction_limit: '2', start_seconds: '1', end_seconds: '0', royalty_bps: '0', fee_bps: '0' },
  };
  for (const query of ['mintera', '0xdrop123', '0xcollection456', '0xcreator789']) {
    expect(searchLaunchpadDrops([drop], query, 2n)[0]).toMatchObject({ area: 'launchpad', href: '/collection/0xdrop123', name: 'Mintera Drop' });
  }
});
