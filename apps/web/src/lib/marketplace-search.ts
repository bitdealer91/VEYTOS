import type { MarketplaceCollectionSummary } from './marketplace-data';
import { dropStatus } from '@veytos/aptos/domain';
import type { Drop } from '@veytos/aptos/types';

export type MarketplaceSearchResult = Pick<MarketplaceCollectionSummary,
  'key' | 'standard' | 'name' | 'creator' | 'creatorName' | 'metadataUri' | 'verified' | 'native' | 'floorPrice' | 'activeListings'> & { area: 'marketplace'; href: string };

export type LaunchpadSearchResult = {
  area: 'launchpad'; href: string; address: string; collection: string; name: string; creator: string; metadataUri: string;
  status: ReturnType<typeof dropStatus>; minted: string; supply: string; price: string;
};

export type GlobalSearchResult = MarketplaceSearchResult | LaunchpadSearchResult;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function score(collection: MarketplaceCollectionSummary, query: string) {
  const name = normalize(collection.name);
  const creatorName = normalize(collection.creatorName || '');
  const creator = normalize(collection.creator);
  const key = normalize(collection.key);

  if (name === query) return 0;
  if (creatorName === query) return 1;
  if (creator === query || key === query) return 2;
  if (name.startsWith(query)) return 3;
  if (creatorName.startsWith(query)) return 4;
  if (name.includes(query)) return 5;
  if (creatorName.includes(query)) return 6;
  if (creator.includes(query) || key.includes(query)) return 7;
  return null;
}

export function searchMarketplaceCollections(collections: MarketplaceCollectionSummary[], rawQuery: string, limit = 6): MarketplaceSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  return collections
    .map((collection) => ({ collection, rank: score(collection, query) }))
    .filter((entry): entry is { collection: MarketplaceCollectionSummary; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || Number(b.collection.verified) - Number(a.collection.verified) || a.collection.name.localeCompare(b.collection.name))
    .slice(0, limit)
    .map(({ collection }) => ({
      area: 'marketplace',
      href: `/explore/${encodeURIComponent(collection.key)}`,
      key: collection.key,
      standard: collection.standard,
      name: collection.name,
      creator: collection.creator,
      creatorName: collection.creatorName,
      metadataUri: collection.metadataUri,
      verified: collection.verified,
      native: collection.native,
      floorPrice: collection.floorPrice,
      activeListings: collection.activeListings,
    }));
}

function scoreDrop(drop: Drop, query: string) {
  const name = normalize(drop.terms.name);
  const creator = normalize(drop.terms.creator);
  const address = normalize(drop.address);
  const collection = normalize(drop.collection);
  if (name === query) return 0;
  if (address === query || collection === query) return 1;
  if (creator === query) return 2;
  if (name.startsWith(query)) return 3;
  if (name.includes(query)) return 4;
  if (address.includes(query) || collection.includes(query) || creator.includes(query)) return 5;
  return null;
}

export function searchLaunchpadDrops(drops: Drop[], rawQuery: string, now: bigint, limit = 6): LaunchpadSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];
  return drops
    .map((drop) => ({ drop, rank: scoreDrop(drop, query) }))
    .filter((entry): entry is { drop: Drop; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.drop.terms.name.localeCompare(b.drop.terms.name))
    .slice(0, limit)
    .map(({ drop }) => ({
      area: 'launchpad', href: `/collection/${drop.address}`, address: drop.address, collection: drop.collection,
      name: drop.terms.name, creator: drop.terms.creator, metadataUri: drop.terms.collection_uri,
      status: dropStatus(drop, now), minted: drop.minted, supply: drop.terms.max_supply, price: drop.terms.unit_price,
    }));
}
