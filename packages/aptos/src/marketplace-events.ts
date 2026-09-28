import { z } from 'zod';
import { canonical } from './domain.ts';
import { encodeNFTIdentity } from './marketplace.ts';
import type { TokenIdentity } from './types.ts';

const integer = z.union([z.string(), z.number().int().nonnegative()]).transform(String).pipe(z.string().regex(/^\d+$/));
const assetSchema = z.object({
  standard: z.union([z.literal(1), z.literal(2), z.literal('1'), z.literal('2')]),
  v1_creator: z.string(), v1_collection: z.string(), v1_token: z.string(), v1_property_version: integer,
  v2_token: z.string(), collection: z.string(),
});
const baseSchema = z.object({ listing_id: integer, asset: assetSchema, seller: z.string(), timestamp: integer });
const listedSchema = baseSchema.extend({
  gross_price: integer, fee_bps: integer, storage_reimbursement: integer,
  royalty_payee: z.string(), royalty_numerator: integer, royalty_denominator: integer,
});
const purchasedSchema = baseSchema.extend({
  buyer: z.string(), gross_price: integer, platform_fee_recipient: z.string(), platform_fee: integer,
  royalty_recipient: z.string(), royalty: integer, seller_proceeds: integer, storage_reimbursement: integer,
});

export type MarketplaceProjectionEvent = {
  eventType: 'LISTED' | 'CANCELLED' | 'PURCHASED';
  listingId: string;
  standard: 'v1' | 'v2';
  identity: TokenIdentity;
  assetKey: string;
  collectionKey: string;
  seller: string;
  buyer: string | null;
  grossPrice: string | null;
  version: string;
  eventIndex: number;
  hash: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

function identity(asset: z.infer<typeof assetSchema>): { identity: TokenIdentity; collectionKey: string } {
  if (Number(asset.standard) === 1) {
    const creator = canonical(asset.v1_creator);
    return {
      identity: { standard: 'v1', creator, collection: asset.v1_collection, name: asset.v1_token, propertyVersion: asset.v1_property_version },
      collectionKey: `v1:${creator}:${asset.v1_collection}`,
    };
  }
  return {
    identity: { standard: 'v2', address: canonical(asset.v2_token) },
    collectionKey: `v2:${canonical(asset.collection)}`,
  };
}

export function projectMarketplaceTransaction(transaction: unknown, moduleAddress: string): MarketplaceProjectionEvent[] {
  const module = canonical(moduleAddress);
  if (!transaction || typeof transaction !== 'object' || !('type' in transaction) || transaction.type !== 'user_transaction') return [];
  const tx = z.object({
    type: z.literal('user_transaction'), success: z.boolean(), version: integer,
    hash: z.string().regex(/^0x[0-9a-f]{64}$/i), timestamp: integer,
    events: z.array(z.object({ type: z.string(), data: z.record(z.string(), z.unknown()) })),
  }).parse(transaction);
  if (!tx.success) return [];
  return tx.events.flatMap((event, eventIndex) => {
    const suffix = event.type.startsWith(`${module}::marketplace::`) ? event.type.slice(`${module}::marketplace::`.length) : '';
    if (!['NFTListed', 'ListingCancelled', 'NFTPurchased'].includes(suffix)) return [];
    const parsed = suffix === 'NFTListed' ? listedSchema.parse(event.data)
      : suffix === 'NFTPurchased' ? purchasedSchema.parse(event.data) : baseSchema.parse(event.data);
    const normalized = identity(parsed.asset);
    return [{
      eventType: suffix === 'NFTListed' ? 'LISTED' : suffix === 'NFTPurchased' ? 'PURCHASED' : 'CANCELLED',
      listingId: parsed.listing_id,
      standard: normalized.identity.standard,
      identity: normalized.identity,
      assetKey: encodeNFTIdentity(normalized.identity),
      collectionKey: normalized.collectionKey,
      seller: canonical(parsed.seller),
      buyer: 'buyer' in parsed ? canonical(String(parsed.buyer)) : null,
      grossPrice: 'gross_price' in parsed ? String(parsed.gross_price) : null,
      version: tx.version,
      eventIndex,
      hash: tx.hash.toLowerCase(),
      timestamp: parsed.timestamp,
      payload: event.data,
    } satisfies MarketplaceProjectionEvent];
  });
}
