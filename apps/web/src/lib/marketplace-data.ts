import 'server-only';
import { cache } from 'react';
import pg from 'pg';
import { projectMarketplaceTransaction } from '@veytos/aptos/marketplace-events';
import type { TokenIdentity } from '@veytos/aptos/types';
import { aptos, marketChain } from './chain';
import { marketplaceAddress, network } from './config';

export type BrowseListing={listing_id:string;standard:'v1'|'v2';asset_key:string;collection_key:string;seller_address:string;price_octas:string;listed_version:string};
export const marketplaceBrowse=cache(async(options:{standard?:string;collection?:string;minPrice?:string;maxPrice?:string;sort?:string;limit?:number}={})=>{
  if(!process.env.DATABASE_URL||!marketplaceAddress)return {items:[] as BrowseListing[],configured:false};
  const limit=Math.min(100,Math.max(1,options.limit??48));const clauses=['network=$1','module_address=$2',"status='ACTIVE'"];const values:unknown[]=[network,marketplaceAddress];
  if(options.standard==='v1'||options.standard==='v2'){values.push(options.standard);clauses.push(`standard=$${values.length}`);}
  if(options.collection){values.push(`%${options.collection.replace(/[%_]/g,'')}%`);clauses.push(`collection_key ILIKE $${values.length}`);}
  if(options.minPrice&&/^\d+$/.test(options.minPrice)){values.push(options.minPrice);clauses.push(`price_octas >= $${values.length}`);}
  if(options.maxPrice&&/^\d+$/.test(options.maxPrice)){values.push(options.maxPrice);clauses.push(`price_octas <= $${values.length}`);}
  const order=options.sort==='price-asc'?'price_octas ASC':options.sort==='price-desc'?'price_octas DESC':'listed_version DESC';values.push(limit);
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});try{const result=await pool.query<BrowseListing>(`SELECT listing_id,standard,asset_key,collection_key,seller_address,price_octas,listed_version FROM marketplace_listings WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT $${values.length}`,values);return {items:result.rows,configured:true};}finally{await pool.end();}
});

export const activeListingFor = cache(async (identity: TokenIdentity, collectionId?: string) => {
  // Trading pages use the fullnode's canonical active_assets table. The database
  // and Indexer are projections for discovery and must never override this read.
  return marketChain().activeListing(identity, collectionId);
});

export const marketplaceAssetStateFor = cache(async (identity: TokenIdentity, collectionId?: string) => {
  return marketChain().assetState(identity, collectionId, undefined, { retries: 0 });
});

export const marketplaceActivity = cache(async () => {
  if (!marketplaceAddress) return [];
  const moduleAddress = marketplaceAddress;
  if (!process.env.DATABASE_URL) {
    const hashes = [...new Set((process.env.VEYTOS_MARKETPLACE_TXS || '').split(',').map((value) => value.trim()).filter((value) => /^0x[0-9a-f]{64}$/i.test(value)))].slice(0, 50);
    const receipts = await Promise.allSettled(hashes.map((hash) => aptos.getTransactionByHash({ transactionHash: hash })));
    return receipts.flatMap((receipt) => receipt.status === 'fulfilled' ? projectMarketplaceTransaction(receipt.value, moduleAddress).map((event) => ({
      event_type: event.eventType, listing_id: event.listingId, standard: event.standard, asset_key: event.assetKey,
      collection_key: event.collectionKey, seller_address: event.seller, buyer_address: event.buyer,
      gross_price_octas: event.grossPrice, transaction_hash: event.hash, transaction_version: event.version, event_index: event.eventIndex,
    })) : []).sort((a, b) => BigInt(a.transaction_version) > BigInt(b.transaction_version) ? -1 : 1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const result = await pool.query(
      `SELECT event_type,listing_id,standard,asset_key,collection_key,seller_address,buyer_address,
              gross_price_octas,transaction_hash,transaction_version,chain_timestamp
       FROM marketplace_events WHERE network=$1 AND module_address=$2
       ORDER BY transaction_version DESC,event_index DESC LIMIT 100`, [network, marketplaceAddress],
    );
    return result.rows;
  } finally { await pool.end(); }
});

export const walletMarketplaceProjection = cache(async (address: string) => {
  if (!process.env.DATABASE_URL || !marketplaceAddress) return { listings: [], events: [], configured: false };
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const [listings, events] = await Promise.all([
      pool.query(`SELECT listing_id,standard,asset_key,price_octas,status FROM marketplace_listings
        WHERE network=$1 AND module_address=$2 AND seller_address=$3 AND status='ACTIVE' ORDER BY listed_version DESC LIMIT 100`, [network, marketplaceAddress, address]),
      pool.query(`SELECT event_type,listing_id,standard,asset_key,seller_address,buyer_address,gross_price_octas,transaction_hash,transaction_version,event_index
        FROM marketplace_events WHERE network=$1 AND module_address=$2 AND (seller_address=$3 OR buyer_address=$3)
        ORDER BY transaction_version DESC,event_index DESC LIMIT 100`, [network, marketplaceAddress, address]),
    ]);
    return { listings: listings.rows, events: events.rows, configured: true };
  } finally { await pool.end(); }
});

export const collectionMarketplaceProjection = cache(async (collectionAddress: string) => {
  const empty = { configured: false, activeListings: '0', floorPrice: null as string | null, sales: '0', volume: '0', events: [] as Record<string, unknown>[] };
  if (!process.env.DATABASE_URL || !marketplaceAddress) return empty;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const key = `v2:${collectionAddress}`;
  try {
    const [active, sales, events] = await Promise.all([
      pool.query<{ count: string; floor: string | null }>(`SELECT count(*)::text AS count,min(price_octas)::text AS floor FROM marketplace_listings WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND status='ACTIVE'`, [network, marketplaceAddress, key]),
      pool.query<{ count: string; volume: string }>(`SELECT count(*)::text AS count,coalesce(sum(gross_price_octas),0)::text AS volume FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 AND event_type='PURCHASED'`, [network, marketplaceAddress, key]),
      pool.query(`SELECT event_type,listing_id,standard,asset_key,seller_address,buyer_address,gross_price_octas,transaction_hash,transaction_version,event_index FROM marketplace_events WHERE network=$1 AND module_address=$2 AND collection_key=$3 ORDER BY transaction_version DESC,event_index DESC LIMIT 30`, [network, marketplaceAddress, key]),
    ]);
    return { configured: true, activeListings: active.rows[0]?.count || '0', floorPrice: active.rows[0]?.floor || null, sales: sales.rows[0]?.count || '0', volume: sales.rows[0]?.volume || '0', events: events.rows };
  } finally { await pool.end(); }
});
