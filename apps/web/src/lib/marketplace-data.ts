import 'server-only';
import { cache } from 'react';
import {
  discoverCollectionNFTs,
  discoverCollectionsByIdentity,
  discoverNFTsByIdentity,
  type CollectionIdentity,
  type NormalizedCollection,
  type NormalizedNFT,
} from '@veytos/aptos/discovery';
import { canonical } from '@veytos/aptos/domain';
import { decodeNFTIdentity, encodeNFTIdentity } from '@veytos/aptos/marketplace';
import { projectMarketplaceTransaction } from '@veytos/aptos/marketplace-events';
import type { TokenIdentity } from '@veytos/aptos/types';
import { aptos, marketChain } from './chain';
import { marketplaceAddress, network } from './config';
import { discovery } from './data';
import { database } from './database';
import { errorCategory } from './observability';

const indexerUrl = `https://api.${network}.aptoslabs.com/v1/graphql`;

export type BrowseListing = {
  listing_id: string;
  standard: 'v1' | 'v2';
  asset_key: string;
  collection_key: string;
  seller_address: string;
  price_octas: string;
  listed_version: string;
};

export type ProfileMarketplaceListing = BrowseListing & { nft: NormalizedNFT | null };

export type MarketplaceEvent = {
  event_type: 'LISTED' | 'PURCHASED' | 'CANCELLED';
  listing_id: string;
  standard: 'v1' | 'v2';
  asset_key: string;
  collection_key: string;
  seller_address: string;
  buyer_address: string | null;
  gross_price_octas: string | null;
  transaction_hash: string;
  transaction_version: string;
  event_index: number;
  chain_timestamp: string | null;
};

export type MarketplaceCollectionSummary = {
  key: string;
  standard: 'v1' | 'v2';
  name: string;
  creator: string;
  description: string;
  metadataUri: string;
  bannerUri: string | null;
  creatorName: string | null;
  verified: boolean;
  native: boolean;
  floorPrice: string | null;
  activeListings: string;
  volume24h: string;
  sales24h: string;
  totalVolume: string;
  supply: string | null;
  lastActivity: string | null;
  links: Record<string, string>;
};

export type MarketplaceInventoryItem = {
  assetKey: string;
  standard: 'v1' | 'v2';
  name: string;
  metadataUri: string;
  owner: string | null;
  listingId: string | null;
  seller: string | null;
  price: string | null;
  listedVersion: string | null;
};

type CollectionAggregateRow = {
  collection_key: string;
  standard: 'v1' | 'v2';
  floor_price: string | null;
  active_listings: string;
  volume_24h: string;
  sales_24h: string;
  total_volume: string;
  last_activity: Date | string | null;
};

type NativeCollectionRow = {
  address: string;
  creator_address: string;
  name: string;
  description: string;
  metadata_uri: string;
  banner_uri: string | null;
  verified: boolean;
  display_name: string | null;
  links: Record<string, string> | null;
};

type LaunchpadCollection = {
  collection: string;
  creator: string;
  name: string;
  description: string;
  metadataUri: string;
  supply: string;
};

export function parseMarketplaceCollectionKey(key: string): CollectionIdentity | null {
  if (key.startsWith('v2:')) {
    try { return { standard: 'v2', collectionId: canonical(key.slice(3)) }; } catch { return null; }
  }
  const match = /^v1:(0x[0-9a-f]{1,64}):(.+)$/i.exec(key);
  if (!match) return null;
  try { return { standard: 'v1', creator: canonical(match[1]), name: match[2] }; } catch { return null; }
}

function fallbackCollectionName(identity: CollectionIdentity) {
  return identity.standard === 'v1' ? identity.name : `Collection ${identity.collectionId.slice(0, 8)}…${identity.collectionId.slice(-4)}`;
}

function identityKey(identity: CollectionIdentity) {
  return identity.standard === 'v2'
    ? `v2:${canonical(identity.collectionId)}`
    : `v1:${canonical(identity.creator)}:${identity.name}`;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

async function optionalCollectionMetadata(identities: CollectionIdentity[]) {
  try {
    return { rows: await discoverCollectionsByIdentity(indexerUrl, identities), failed: false };
  } catch (error) {
    console.error(JSON.stringify({ kind: 'marketplace_optional_failure', operation: 'collection_metadata', category: errorCategory(error, 'aptos indexer collection metadata') }));
    return { rows: [] as NormalizedCollection[], failed: true };
  }
}

async function optionalNativeCollections(addresses: string[]) {
  const pool = database();
  if (!pool || !addresses.length) return { rows: [] as NativeCollectionRow[], failed: false };
  try {
    const result = await pool.query<NativeCollectionRow>(`
      SELECT c.address,c.creator_address,c.name,c.description,c.metadata_uri,c.banner_uri,c.verified,
             cp.display_name,
             coalesce(jsonb_object_agg(s.kind,s.url) FILTER (WHERE s.kind IS NOT NULL),'{}'::jsonb) AS links
      FROM collections c
      LEFT JOIN users u ON u.wallet_address=c.creator_address
      LEFT JOIN creator_profiles cp ON cp.user_id=u.id
      LEFT JOIN social_links s ON s.collection_id=c.id
      WHERE c.network=$1 AND c.address=ANY($2::text[]) AND c.hidden=false
      GROUP BY c.id,cp.display_name`, [network, addresses]);
    return { rows: result.rows, failed: false };
  } catch (error) {
    console.error(JSON.stringify({ kind: 'marketplace_optional_failure', operation: 'native_collection_metadata', category: errorCategory(error, 'database native collection metadata') }));
    return { rows: [] as NativeCollectionRow[], failed: true };
  }
}

async function optionalLaunchpadCollections() {
  try {
    const result = await discovery();
    return {
      rows: result.drops.map((drop): LaunchpadCollection => ({
        collection: canonical(drop.collection), creator: canonical(drop.terms.creator), name: drop.terms.name,
        description: drop.terms.description, metadataUri: drop.terms.collection_uri, supply: drop.terms.max_supply,
      })),
      configured: result.configured,
      failed: result.errors > 0,
    };
  } catch (error) {
    console.error(JSON.stringify({ kind: 'marketplace_optional_failure', operation: 'launchpad_collection_catalog', category: errorCategory(error, 'launchpad collection catalog') }));
    return { rows: [] as LaunchpadCollection[], configured: false, failed: true };
  }
}

function enrichCollection(aggregate: CollectionAggregateRow, metadata: Map<string, NormalizedCollection>, native: Map<string, NativeCollectionRow>, launchpad = new Map<string, LaunchpadCollection>()): MarketplaceCollectionSummary | null {
  const identity = parseMarketplaceCollectionKey(aggregate.collection_key);
  if (!identity) return null;
  const indexed = metadata.get(aggregate.collection_key);
  const nativeRecord = identity.standard === 'v2' ? native.get(identity.collectionId) : undefined;
  const launchpadRecord = identity.standard === 'v2' ? launchpad.get(identity.collectionId) : undefined;
  return {
    key: aggregate.collection_key,
    standard: identity.standard,
    name: indexed?.name || nativeRecord?.name || launchpadRecord?.name || fallbackCollectionName(identity),
    creator: nativeRecord?.creator_address || launchpadRecord?.creator || indexed?.creator || (identity.standard === 'v1' ? identity.creator : identity.collectionId),
    description: indexed?.description || nativeRecord?.description || launchpadRecord?.description || '',
    metadataUri: indexed?.metadataUri || nativeRecord?.metadata_uri || launchpadRecord?.metadataUri || '',
    bannerUri: nativeRecord?.banner_uri || null,
    creatorName: nativeRecord?.display_name || null,
    verified: nativeRecord?.verified || false,
    native: !!nativeRecord || !!launchpadRecord,
    floorPrice: aggregate.floor_price,
    activeListings: aggregate.active_listings,
    volume24h: aggregate.volume_24h,
    sales24h: aggregate.sales_24h,
    totalVolume: aggregate.total_volume,
    supply: launchpadRecord?.supply || indexed?.currentSupply || null,
    lastActivity: iso(aggregate.last_activity),
    links: nativeRecord?.links || {},
  };
}

function emptyAggregate(identity: CollectionIdentity): CollectionAggregateRow {
  return {
    collection_key: identityKey(identity), standard: identity.standard, floor_price: null, active_listings: '0',
    volume_24h: '0', sales_24h: '0', total_volume: '0', last_activity: null,
  };
}

function sortCollections(items: MarketplaceCollectionSummary[], sort: string | undefined) {
  const numeric = (value: string) => BigInt(value || '0');
  const compareNullable = (a: string | null, b: string | null, direction: 1 | -1) => {
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return numeric(a) === numeric(b) ? 0 : numeric(a) > numeric(b) ? direction : -direction;
  };
  return items.sort((a, b) => {
    if (sort === 'floor-asc') return compareNullable(a.floorPrice, b.floorPrice, 1) || a.name.localeCompare(b.name);
    if (sort === 'floor-desc') return compareNullable(a.floorPrice, b.floorPrice, -1) || a.name.localeCompare(b.name);
    if (sort === 'listed') return (numeric(a.activeListings) === numeric(b.activeListings) ? 0 : numeric(a.activeListings) > numeric(b.activeListings) ? -1 : 1) || a.name.localeCompare(b.name);
    if (sort === 'active') return (b.lastActivity || '').localeCompare(a.lastActivity || '') || a.name.localeCompare(b.name);
    return (numeric(a.volume24h) === numeric(b.volume24h) ? 0 : numeric(a.volume24h) > numeric(b.volume24h) ? -1 : 1) || (b.lastActivity || '').localeCompare(a.lastActivity || '') || a.name.localeCompare(b.name);
  });
}

export const marketplaceBrowse = cache(async (options: { standard?: string; collection?: string; minPrice?: string; maxPrice?: string; sort?: string; limit?: number } = {}) => {
  const pool = database();
  if (!pool || !marketplaceAddress) return { items: [] as BrowseListing[], configured: false, failed: false };
  const limit = Math.min(100, Math.max(1, options.limit ?? 48));
  const clauses = ['network=$1', 'module_address=$2', "status='ACTIVE'"];
  const values: unknown[] = [network, marketplaceAddress];
  if (options.standard === 'v1' || options.standard === 'v2') { values.push(options.standard); clauses.push(`standard=$${values.length}`); }
  if (options.collection) { values.push(`%${options.collection.replace(/[%_]/g, '')}%`); clauses.push(`collection_key ILIKE $${values.length}`); }
  if (options.minPrice && /^\d+$/.test(options.minPrice)) { values.push(options.minPrice); clauses.push(`price_octas >= $${values.length}`); }
  if (options.maxPrice && /^\d+$/.test(options.maxPrice)) { values.push(options.maxPrice); clauses.push(`price_octas <= $${values.length}`); }
  const order = options.sort === 'price-asc' ? 'price_octas ASC' : options.sort === 'price-desc' ? 'price_octas DESC' : 'listed_version DESC';
  values.push(limit);
  try {
    const result = await pool.query<BrowseListing>(`SELECT listing_id,standard,asset_key,collection_key,seller_address,price_octas,listed_version FROM marketplace_listings WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT $${values.length}`, values);
    return { items: result.rows, configured: true, failed: false };
  } catch {
    console.error(JSON.stringify({ kind: 'indexer_failure', operation: 'marketplace_browse' }));
    return { items: [] as BrowseListing[], configured: true, failed: true };
  }
});

export const marketplaceCollections = cache(async (options: { sort?: string; limit?: number } = {}) => {
  const pool = database();
  const limit = Math.min(100, Math.max(1, options.limit ?? 100));
  const launchpadResult = await optionalLaunchpadCollections();
  const launchpad = new Map(launchpadResult.rows.map((row) => [row.collection, row]));
  let projectionRows: CollectionAggregateRow[] = [];
  let projectionFailed = false;
  try {
    if (pool && marketplaceAddress) {
      const result = await pool.query<CollectionAggregateRow>(`
      WITH collection_keys AS (
        SELECT collection_key,standard FROM marketplace_listings WHERE network=$1 AND module_address=$2
        UNION SELECT collection_key,standard FROM marketplace_events WHERE network=$1 AND module_address=$2
      ), active AS (
        SELECT collection_key,count(*) AS active_listings,min(price_octas) AS floor_price
        FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND status='ACTIVE' GROUP BY collection_key
      ), purchases AS (
        SELECT collection_key,
          coalesce(sum(gross_price_octas) FILTER (WHERE chain_timestamp>=now()-interval '24 hours'),0) AS volume_24h,
          count(*) FILTER (WHERE chain_timestamp>=now()-interval '24 hours') AS sales_24h,
          coalesce(sum(gross_price_octas),0) AS total_volume
        FROM marketplace_events WHERE network=$1 AND module_address=$2 AND event_type='PURCHASED' GROUP BY collection_key
      ), recent AS (
        SELECT collection_key,max(chain_timestamp) AS last_activity
        FROM marketplace_events WHERE network=$1 AND module_address=$2 GROUP BY collection_key
      )
      SELECT k.collection_key,k.standard,a.floor_price,coalesce(a.active_listings,0) AS active_listings,
             coalesce(p.volume_24h,0) AS volume_24h,coalesce(p.sales_24h,0) AS sales_24h,
             coalesce(p.total_volume,0) AS total_volume,r.last_activity
      FROM collection_keys k LEFT JOIN active a USING(collection_key)
      LEFT JOIN purchases p USING(collection_key) LEFT JOIN recent r USING(collection_key)
      LIMIT $3`, [network, marketplaceAddress, 100]);
      projectionRows = result.rows;
    }
    const aggregateByKey = new Map(projectionRows.map((row) => [row.collection_key, row]));
    for (const row of launchpadResult.rows) {
      const identity: CollectionIdentity = { standard: 'v2', collectionId: row.collection };
      if (!aggregateByKey.has(identityKey(identity))) aggregateByKey.set(identityKey(identity), emptyAggregate(identity));
    }
    const aggregates = [...aggregateByKey.values()];
    const identities = aggregates.map((row) => parseMarketplaceCollectionKey(row.collection_key)).filter((value): value is CollectionIdentity => !!value);
    const addresses = identities.flatMap((identity) => identity.standard === 'v2' ? [identity.collectionId] : []);
    const [metadataResult, nativeResult] = await Promise.all([optionalCollectionMetadata(identities), optionalNativeCollections(addresses)]);
    const metadata = new Map(metadataResult.rows.map((row) => [row.key, row]));
    const native = new Map(nativeResult.rows.map((row) => [canonical(row.address), row]));
    return {
      items: sortCollections(aggregates.map((row) => enrichCollection(row, metadata, native, launchpad)).filter((value): value is MarketplaceCollectionSummary => !!value), options.sort).slice(0, limit),
      configured: (!!pool && !!marketplaceAddress) || launchpadResult.configured,
      failed: projectionFailed,
      metadataFailed: metadataResult.failed || nativeResult.failed || launchpadResult.failed,
    };
  } catch (error) {
    projectionFailed = true;
    console.error(JSON.stringify({ kind: 'indexer_failure', operation: 'marketplace_collections', category: errorCategory(error, 'database marketplace collections') }));
    const items = launchpadResult.rows.map((row) => {
      const identity: CollectionIdentity = { standard: 'v2', collectionId: row.collection };
      return enrichCollection(emptyAggregate(identity), new Map(), new Map(), launchpad);
    }).filter((value): value is MarketplaceCollectionSummary => !!value);
    return { items: sortCollections(items, options.sort).slice(0, limit), configured: launchpadResult.configured, failed: true, metadataFailed: launchpadResult.failed };
  }
});

export const marketplaceCollection = cache(async (key: string) => {
  const identity = parseMarketplaceCollectionKey(key);
  if (!identity) return null;
  const pool = database();
  const blankAggregate = emptyAggregate(identity);
  const launchpadResult = await optionalLaunchpadCollections();
  const launchpad = new Map(launchpadResult.rows.map((row) => [row.collection, row]));
  if (!pool || !marketplaceAddress) {
    const [metadataResult, inventoryResult] = await Promise.all([
      optionalCollectionMetadata([identity]),
      discoverCollectionNFTs(indexerUrl, identity, 100).then((value) => ({ value, failed: false })).catch((error) => {
        console.error(JSON.stringify({ kind: 'marketplace_optional_failure', operation: 'collection_inventory', category: errorCategory(error, 'aptos indexer collection inventory') }));
        return { value: { items: [] as NormalizedNFT[] }, failed: true };
      }),
    ]);
    const metadata = new Map(metadataResult.rows.map((row) => [row.key, row]));
    return {
      collection: enrichCollection(blankAggregate, metadata, new Map(), launchpad)!,
      items: inventoryResult.value.items.map((nft): MarketplaceInventoryItem => ({
        assetKey: encodeNFTIdentity(nft.identity), standard: nft.standard, name: nft.name || 'Unnamed NFT',
        metadataUri: nft.metadataUri, owner: nft.owner, listingId: null, seller: null, price: null, listedVersion: null,
      })),
      events: [] as MarketplaceEvent[], configured: launchpadResult.configured, failed: false,
      metadataFailed: metadataResult.failed || launchpadResult.failed, inventoryFailed: inventoryResult.failed,
    };
  }
  const canonicalKey = identityKey(identity);
  try {
    const [aggregateResult, listingsResult, eventsResult] = await Promise.all([
      pool.query<CollectionAggregateRow>(`
        SELECT $3::text AS collection_key,$4::text AS standard,
          (SELECT min(price_octas)::text FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND status='ACTIVE') AS floor_price,
          (SELECT count(*)::text FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND status='ACTIVE') AS active_listings,
          (SELECT coalesce(sum(gross_price_octas),0)::text FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND event_type='PURCHASED' AND chain_timestamp>=now()-interval '24 hours') AS volume_24h,
          (SELECT count(*)::text FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND event_type='PURCHASED' AND chain_timestamp>=now()-interval '24 hours') AS sales_24h,
          (SELECT coalesce(sum(gross_price_octas),0)::text FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND event_type='PURCHASED') AS total_volume,
          (SELECT max(chain_timestamp) FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3) AS last_activity`,
        [network, marketplaceAddress, canonicalKey, identity.standard]),
      pool.query<BrowseListing>(`SELECT listing_id,standard,asset_key,collection_key,seller_address,price_octas,listed_version FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND status='ACTIVE' ORDER BY listed_version DESC LIMIT 100`, [network, marketplaceAddress, canonicalKey]),
      pool.query<MarketplaceEvent>(`SELECT event_type,listing_id,standard,asset_key,collection_key,seller_address,buyer_address,gross_price_octas,transaction_hash,transaction_version,event_index,chain_timestamp FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 ORDER BY transaction_version DESC,event_index DESC LIMIT 40`, [network, marketplaceAddress, canonicalKey]),
    ]);
    const [metadataResult, nativeResult, inventoryResult] = await Promise.all([
      optionalCollectionMetadata([identity]),
      optionalNativeCollections(identity.standard === 'v2' ? [identity.collectionId] : []),
      discoverCollectionNFTs(indexerUrl, identity, 100).then((value) => ({ value, failed: false })).catch((error) => {
        console.error(JSON.stringify({ kind: 'marketplace_optional_failure', operation: 'collection_inventory', category: errorCategory(error, 'aptos indexer collection inventory') }));
        return { value: { items: [] as NormalizedNFT[] }, failed: true };
      }),
    ]);
    const metadata = new Map(metadataResult.rows.map((row) => [row.key, row]));
    const native = new Map(nativeResult.rows.map((row) => [canonical(row.address), row]));
    const listingMap = new Map(listingsResult.rows.map((listing) => [listing.asset_key, listing]));
    const items = inventoryResult.value.items.map((nft): MarketplaceInventoryItem => {
      const assetKey = encodeNFTIdentity(nft.identity);
      const listing = listingMap.get(assetKey);
      listingMap.delete(assetKey);
      return {
        assetKey, standard: nft.standard, name: nft.name || 'Unnamed NFT', metadataUri: nft.metadataUri,
        owner: nft.owner, listingId: listing?.listing_id || null, seller: listing?.seller_address || null,
        price: listing?.price_octas || null, listedVersion: listing?.listed_version || null,
      };
    });
    for (const listing of listingMap.values()) {
      const decoded = decodeNFTIdentity(listing.asset_key);
      items.push({
        assetKey: listing.asset_key,
        standard: listing.standard,
        name: decoded.standard === 'v1' ? decoded.name : `Digital Asset ${decoded.address.slice(0, 8)}…`,
        metadataUri: '', owner: null, listingId: listing.listing_id, seller: listing.seller_address,
        price: listing.price_octas, listedVersion: listing.listed_version,
      });
    }
    return {
      collection: enrichCollection(aggregateResult.rows[0] || blankAggregate, metadata, native, launchpad)!,
      items,
      events: eventsResult.rows.map((event) => ({ ...event, chain_timestamp: iso(event.chain_timestamp) })),
      configured: true,
      failed: false,
      metadataFailed: metadataResult.failed || nativeResult.failed || launchpadResult.failed,
      inventoryFailed: inventoryResult.failed,
    };
  } catch (error) {
    console.error(JSON.stringify({ kind: 'indexer_failure', operation: 'marketplace_collection', category: errorCategory(error, 'database marketplace collection') }));
    return {
      collection: enrichCollection(blankAggregate, new Map(), new Map(), launchpad)!, items: [] as MarketplaceInventoryItem[], events: [] as MarketplaceEvent[],
      configured: true, failed: true, metadataFailed: false, inventoryFailed: false,
    };
  }
});

export const activeListingFor = cache(async (identity: TokenIdentity, collectionId?: string) => marketChain().activeListing(identity, collectionId));
export const marketplaceAssetStateFor = cache(async (identity: TokenIdentity, collectionId?: string) => marketChain().assetState(identity, collectionId, undefined, { retries: 0 }));

export const marketplaceActivity = cache(async () => {
  if (!marketplaceAddress) return { events: [], configured: false, failed: false };
  const moduleAddress = marketplaceAddress;
  const pool = database();
  if (!pool) {
    const hashes = [...new Set((process.env.VEYTOS_MARKETPLACE_TXS || '').split(',').map((value) => value.trim()).filter((value) => /^0x[0-9a-f]{64}$/i.test(value)))].slice(0, 50);
    const receipts = await Promise.allSettled(hashes.map((hash) => aptos.getTransactionByHash({ transactionHash: hash })));
    const events = receipts.flatMap((receipt) => receipt.status === 'fulfilled' ? projectMarketplaceTransaction(receipt.value, moduleAddress).map((event) => ({
      event_type: event.eventType, listing_id: event.listingId, standard: event.standard, asset_key: event.assetKey,
      collection_key: event.collectionKey, seller_address: event.seller, buyer_address: event.buyer,
      gross_price_octas: event.grossPrice, transaction_hash: event.hash, transaction_version: event.version, event_index: event.eventIndex,
    })) : []).sort((a, b) => BigInt(a.transaction_version) > BigInt(b.transaction_version) ? -1 : 1);
    return { events, configured: hashes.length > 0, failed: receipts.some((value) => value.status === 'rejected') };
  }
  try {
    const result = await pool.query(`SELECT event_type,listing_id,standard,asset_key,collection_key,seller_address,buyer_address,gross_price_octas,transaction_hash,transaction_version,chain_timestamp FROM marketplace_events WHERE network=$1 AND module_address=$2 ORDER BY transaction_version DESC,event_index DESC LIMIT 100`, [network, marketplaceAddress]);
    return { events: result.rows, configured: true, failed: false };
  } catch {
    console.error(JSON.stringify({ kind: 'indexer_failure', operation: 'marketplace_activity' }));
    return { events: [], configured: true, failed: true };
  }
});

export const walletMarketplaceProjection = cache(async (address: string, offset = 0, limit = 24) => {
  const pool = database();
  if (!pool || !marketplaceAddress) return { listings: [], events: [], listingsMore: false, eventsMore: false, configured: false };
  const [listings, events] = await Promise.all([
    pool.query<BrowseListing>(`SELECT listing_id,standard,asset_key,collection_key,seller_address,price_octas,listed_version FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND seller_address=$3 AND status='ACTIVE' ORDER BY listed_version DESC LIMIT $4 OFFSET $5`, [network, marketplaceAddress, address, limit + 1, offset]),
    pool.query(`SELECT event_type,listing_id,standard,asset_key,seller_address,buyer_address,gross_price_octas,transaction_hash,transaction_version,event_index FROM marketplace_events WHERE network=$1 AND module_address=$2 AND (seller_address=$3 OR buyer_address=$3) ORDER BY transaction_version DESC,event_index DESC LIMIT $4 OFFSET $5`, [network, marketplaceAddress, address, limit + 1, offset]),
  ]);
  const page = listings.rows.slice(0, limit);
  let metadata: NormalizedNFT[] = [];
  try { metadata = await discoverNFTsByIdentity(indexerUrl, page.map((item) => decodeNFTIdentity(item.asset_key))); }
  catch (error) { console.error(JSON.stringify({ kind: 'marketplace_optional_failure', operation: 'profile_listing_metadata', category: errorCategory(error, 'aptos indexer listing metadata') })); }
  const byAsset = new Map(metadata.map((nft) => [encodeNFTIdentity(nft.identity), nft]));
  const enriched: ProfileMarketplaceListing[] = page.map((item) => ({ ...item, nft: byAsset.get(item.asset_key) || null }));
  return { listings: enriched, events: events.rows.slice(0, limit), listingsMore: listings.rows.length > limit, eventsMore: events.rows.length > limit, configured: true };
});

export const collectionMarketplaceProjection = cache(async (collectionAddress: string) => {
  const empty = { configured: false, failed: false, activeListings: '0', floorPrice: null as string | null, sales: '0', volume: '0', events: [] as Record<string, unknown>[] };
  const pool = database();
  if (!pool || !marketplaceAddress) return empty;
  const key = `v2:${collectionAddress}`;
  try {
    const [active, sales, events] = await Promise.all([
      pool.query<{ count: string; floor: string | null }>(`SELECT count(*)::text AS count,min(price_octas)::text AS floor FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND status='ACTIVE'`, [network, marketplaceAddress, key]),
      pool.query<{ count: string; volume: string }>(`SELECT count(*)::text AS count,coalesce(sum(gross_price_octas),0)::text AS volume FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND event_type='PURCHASED'`, [network, marketplaceAddress, key]),
      pool.query(`SELECT event_type,listing_id,standard,asset_key,seller_address,buyer_address,gross_price_octas,transaction_hash,transaction_version,event_index,chain_timestamp FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 ORDER BY transaction_version DESC,event_index DESC LIMIT 30`, [network, marketplaceAddress, key]),
    ]);
    return { configured: true, failed: false, activeListings: active.rows[0]?.count || '0', floorPrice: active.rows[0]?.floor || null, sales: sales.rows[0]?.count || '0', volume: sales.rows[0]?.volume || '0', events: events.rows.map((event) => ({ ...event, chain_timestamp: event.chain_timestamp instanceof Date ? event.chain_timestamp.toISOString() : event.chain_timestamp })) };
  } catch (error) {
    console.error(JSON.stringify({ kind: 'marketplace_optional_failure', network, package: marketplaceAddress, collection: collectionAddress, upstream: 'database', operation: 'collection_activity', category: errorCategory(error, 'database collection activity'), fresh: false }));
    return { ...empty, configured: true, failed: true };
  }
});
