import { Aptos } from '@aptos-labs/ts-sdk';
import { z } from 'zod';
import { canonical } from './domain.ts';
import type { TokenIdentity } from './types.ts';
import { encodeNFTIdentity } from './marketplace.ts';

const address = z.string().regex(/^0x[\da-f]{1,64}$/i).transform(canonical);
const integer = z.union([z.string(), z.number().int().nonnegative(), z.bigint().nonnegative()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value));
const collectionSchema = z.object({
  collection_id: address,
  collection_name: z.string(),
  creator_address: address,
  token_standard: z.enum(['v1', 'v2']),
  uri: z.string(),
});
const tokenSchema = z.object({
  collection_id: address,
  description: z.string(),
  token_data_id: address,
  token_name: z.string(),
  token_standard: z.enum(['v1', 'v2']),
  token_uri: z.string(),
  current_collection: collectionSchema,
  maximum: integer.optional().nullable(),
  token_properties: z.unknown().optional().nullable(),
  current_royalty_v1: z.object({
    payee_address: address,
    royalty_points_numerator: integer,
    royalty_points_denominator: integer,
  }).optional().nullable(),
});
const ownershipSchema = z.object({
  token_standard: z.enum(['v1', 'v2']),
  token_data_id: address,
  property_version_v1: integer,
  owner_address: address,
  last_transaction_version: integer,
  amount: integer,
  current_token_data: tokenSchema,
  is_soulbound_v2: z.boolean().optional().nullable(),
});

export type NormalizedNFT = {
  standard: 'v1' | 'v2';
  identity: TokenIdentity;
  tokenId: string;
  collectionId: string;
  owner: string;
  amount: string;
  name: string;
  description: string;
  metadataUri: string;
  image: null;
  collectionName: string;
  collectionCreator: string;
  collectionMetadataUri: string;
  lastTransactionVersion: string;
  maximum: string | null;
  properties: unknown;
  royalty: { payee: string; numerator: string; denominator: string } | null;
  isSoulbound: boolean;
};

export type NFTDiscoveryResult = {
  items: NormalizedNFT[];
  rejectedRows: number;
  pages: number;
};

export type NFTDiscoveryPage = NFTDiscoveryResult & { offset: number; hasMore: boolean };

export type CollectionIdentity =
  | { standard: 'v2'; collectionId: string }
  | { standard: 'v1'; creator: string; name: string };

export type NormalizedCollection = {
  key: string;
  standard: 'v1' | 'v2';
  collectionId: string;
  name: string;
  creator: string;
  description: string;
  metadataUri: string;
  currentSupply: string;
  maxSupply: string | null;
  lastTransactionVersion: string;
};

export class NFTDiscoveryError extends Error {
  readonly code: 'indexer-unavailable' | 'pagination-limit';
  constructor(code: NFTDiscoveryError['code'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NFTDiscoveryError';
    this.code = code;
  }
}

function rowIdentity(row: z.infer<typeof ownershipSchema>) {
  if (row.token_standard === 'v2') return `v2:${row.token_data_id}`;
  const collection = row.current_token_data.current_collection;
  return `v1:${collection.creator_address}:${collection.collection_name}:${row.current_token_data.token_name}:${row.property_version_v1}`;
}

function normalize(row: z.infer<typeof ownershipSchema>): NormalizedNFT {
  const token = row.current_token_data;
  const collection = token.current_collection;
  const identity: TokenIdentity = row.token_standard === 'v2'
    ? { standard: 'v2', address: row.token_data_id }
    : {
        standard: 'v1',
        creator: collection.creator_address,
        collection: collection.collection_name,
        name: token.token_name,
        propertyVersion: row.property_version_v1,
      };
  return {
    standard: row.token_standard,
    identity,
    tokenId: row.token_data_id,
    collectionId: collection.collection_id,
    owner: row.owner_address,
    amount: row.amount,
    name: token.token_name,
    description: token.description,
    metadataUri: token.token_uri,
    image: null,
    collectionName: collection.collection_name,
    collectionCreator: collection.creator_address,
    collectionMetadataUri: collection.uri,
    lastTransactionVersion: row.last_transaction_version,
    maximum: token.maximum ?? null,
    properties: token.token_properties ?? null,
    royalty: token.current_royalty_v1 ? {
      payee: token.current_royalty_v1.payee_address,
      numerator: token.current_royalty_v1.royalty_points_numerator,
      denominator: token.current_royalty_v1.royalty_points_denominator,
    } : null,
    isSoulbound: row.is_soulbound_v2 ?? false,
  };
}

/** Select the latest ownership row before checking amount so stale positive rows cannot revive a transferred token. */
export function normalizeOwnershipRows(rows: readonly unknown[], expectedOwner?: string) {
  const owner = expectedOwner === undefined ? undefined : canonical(expectedOwner);
  const latest = new Map<string, z.infer<typeof ownershipSchema>>();
  let rejectedRows = 0;
  for (const candidate of rows) {
    const parsed = ownershipSchema.safeParse(candidate);
    if (!parsed.success || (owner !== undefined && parsed.data.owner_address !== owner) ||
        parsed.data.token_standard !== parsed.data.current_token_data.token_standard ||
        parsed.data.token_standard !== parsed.data.current_token_data.current_collection.token_standard) {
      rejectedRows += 1;
      continue;
    }
    const key = rowIdentity(parsed.data);
    const previous = latest.get(key);
    const newer = !previous || BigInt(parsed.data.last_transaction_version) > BigInt(previous.last_transaction_version);
    const sameVersionHigherBalance = previous && parsed.data.last_transaction_version === previous.last_transaction_version &&
      BigInt(parsed.data.amount) > BigInt(previous.amount);
    if (newer || sameVersionHigherBalance) {
      latest.set(key, parsed.data);
    }
  }
  const items = [...latest.values()]
    .filter((row) => BigInt(row.amount) > 0n)
    .map(normalize)
    .sort((a, b) => a.lastTransactionVersion === b.lastTransactionVersion
      ? rowIdentityForNormalized(a).localeCompare(rowIdentityForNormalized(b))
      : BigInt(a.lastTransactionVersion) > BigInt(b.lastTransactionVersion) ? -1 : 1);
  return { items, rejectedRows };
}

function rowIdentityForNormalized(item: NormalizedNFT) {
  return item.identity.standard === 'v2'
    ? `v2:${item.identity.address}`
    : `v1:${item.identity.creator}:${item.identity.collection}:${item.identity.name}:${item.identity.propertyVersion}`;
}

export async function discoverOwnedNFTs(
  aptos: Aptos,
  owner: string,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<NFTDiscoveryResult> {
  const accountAddress = canonical(owner);
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 100;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError('pageSize must be 1..100');
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new RangeError('maxPages must be 1..1000');

  const rows: unknown[] = [];
  let pages = 0;
  try {
    for (let page = 0; page <= maxPages; page += 1) {
      const result = await aptos.getAccountOwnedTokens({
        accountAddress,
        options: {
          offset: page * pageSize,
          limit: pageSize,
          orderBy: [
            { last_transaction_version: 'desc' },
            { token_data_id: 'asc' },
            { property_version_v1: 'asc' },
          ],
        },
      });
      if (page === maxPages && result.length > 0) {
        throw new NFTDiscoveryError('pagination-limit', `NFT discovery exceeded ${maxPages} pages`);
      }
      if (result.length === 0) break;
      pages += 1;
      rows.push(...result);
      if (result.length < pageSize) break;
    }
  } catch (error) {
    if (error instanceof NFTDiscoveryError) throw error;
    throw new NFTDiscoveryError('indexer-unavailable', 'Aptos NFT ownership is unavailable', { cause: error });
  }
  return { ...normalizeOwnershipRows(rows, accountAddress), pages };
}

export async function discoverOwnedNFTPage(
  aptos: Aptos,
  owner: string,
  options: { offset?: number; pageSize?: number } = {},
): Promise<NFTDiscoveryPage> {
  const accountAddress = canonical(owner);
  const offset = options.offset ?? 0;
  const pageSize = options.pageSize ?? 24;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('offset must be nonnegative');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError('pageSize must be 1..100');
  try {
    const rows = await aptos.getAccountOwnedTokens({
      accountAddress,
      options: {
        offset,
        limit: pageSize + 1,
        orderBy: [{ last_transaction_version: 'desc' }, { token_data_id: 'asc' }, { property_version_v1: 'asc' }],
      },
    });
    const hasMore = rows.length > pageSize;
    const normalized = normalizeOwnershipRows(rows.slice(0, pageSize), accountAddress);
    return { ...normalized, pages: 1, offset, hasMore };
  } catch (error) {
    throw new NFTDiscoveryError('indexer-unavailable', 'Aptos NFT ownership is unavailable', { cause: error });
  }
}

const ownedNftPageQuery = `query ownedNftPage($owner: String!, $offset: Int!, $limit: Int!) {
  current_token_ownerships_v2(
    where:{owner_address:{_eq:$owner},amount:{_gt:0}},
    order_by:[{last_transaction_version:desc},{token_data_id:asc},{property_version_v1:asc}],
    offset:$offset,
    limit:$limit
  ) {
    token_standard token_data_id property_version_v1 owner_address last_transaction_version amount is_soulbound_v2
    current_token_data { collection_id description token_data_id token_name token_standard token_uri maximum token_properties
      current_royalty_v1 { payee_address royalty_points_numerator royalty_points_denominator }
      current_collection { collection_id collection_name creator_address token_standard uri } }
  }
}`;

/**
 * Read one authoritative wallet page directly from the Indexer GraphQL API.
 * This keeps profile ownership independent from fullnode endpoint configuration.
 */
export async function discoverOwnedNFTPageByIndexer(
  indexerUrl: string,
  owner: string,
  options: { offset?: number; pageSize?: number } = {},
): Promise<NFTDiscoveryPage> {
  const accountAddress = canonical(owner);
  const offset = options.offset ?? 0;
  const pageSize = options.pageSize ?? 24;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('offset must be nonnegative');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError('pageSize must be 1..100');
  const data = await queryIndexer<{ current_token_ownerships_v2?: unknown[] }>(indexerUrl, ownedNftPageQuery, {
    owner: accountAddress, offset, limit: pageSize + 1,
  });
  if (!data.current_token_ownerships_v2) throw new NFTDiscoveryError('indexer-unavailable', 'Indexer wallet inventory is unavailable');
  const rows = data.current_token_ownerships_v2;
  const normalized = normalizeOwnershipRows(rows.slice(0, pageSize), accountAddress);
  return { ...normalized, pages: 1, offset, hasMore: rows.length > pageSize };
}

const ownershipQuery = `query nft($where: current_token_ownerships_v2_bool_exp!) {
  current_token_ownerships_v2(where:$where,order_by:[{last_transaction_version:desc}],limit:20) {
    token_standard token_data_id property_version_v1 owner_address last_transaction_version amount
    current_token_data { collection_id description token_data_id token_name token_standard token_uri maximum token_properties
      current_royalty_v1 { payee_address royalty_points_numerator royalty_points_denominator }
      current_collection { collection_id collection_name creator_address token_standard uri } }
  }
}`;

const ownershipBatchQuery = `query nfts($where: current_token_ownerships_v2_bool_exp!, $limit: Int!) {
  current_token_ownerships_v2(where:$where,order_by:[{last_transaction_version:desc}],limit:$limit) {
    token_standard token_data_id property_version_v1 owner_address last_transaction_version amount is_soulbound_v2
    current_token_data { collection_id description token_data_id token_name token_standard token_uri maximum token_properties
      current_royalty_v1 { payee_address royalty_points_numerator royalty_points_denominator }
      current_collection { collection_id collection_name creator_address token_standard uri } }
  }
}`;

/** Resolve a bounded set of NFT identities with one Indexer request. */
export async function discoverNFTsByIdentity(indexerUrl: string, identities: readonly TokenIdentity[]): Promise<NormalizedNFT[]> {
  if (!identities.length) return [];
  if (identities.length > 100) throw new RangeError('identities must contain at most 100 NFTs');
  const where = identities.map((identity) => identity.standard === 'v2'
    ? { token_standard: { _eq: 'v2' }, token_data_id: { _eq: canonical(identity.address) }, amount: { _gt: 0 } }
    : {
        token_standard: { _eq: 'v1' }, property_version_v1: { _eq: identity.propertyVersion }, amount: { _gt: 0 },
        current_token_data: {
          token_name: { _eq: identity.name },
          current_collection: { creator_address: { _eq: canonical(identity.creator) }, collection_name: { _eq: identity.collection } },
        },
      });
  const response = await fetch(indexerUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: ownershipBatchQuery, variables: { where: { _or: where }, limit: identities.length * 2 } }),
  });
  if (!response.ok) throw new NFTDiscoveryError('indexer-unavailable', `Indexer HTTP ${response.status}`);
  const body = await response.json() as { data?: { current_token_ownerships_v2?: unknown[] }; errors?: unknown[] };
  if (body.errors?.length || !body.data?.current_token_ownerships_v2) throw new NFTDiscoveryError('indexer-unavailable', 'Indexer GraphQL error');
  return normalizeOwnershipRows(body.data.current_token_ownerships_v2).items;
}

export async function discoverNFTByIdentity(indexerUrl: string, identity: TokenIdentity): Promise<NormalizedNFT | null> {
  const where = identity.standard === 'v2'
    ? { token_standard: { _eq: 'v2' }, token_data_id: { _eq: canonical(identity.address) } }
    : {
        token_standard: { _eq: 'v1' }, property_version_v1: { _eq: identity.propertyVersion },
        current_token_data: {
          token_name: { _eq: identity.name },
          current_collection: {
            creator_address: { _eq: canonical(identity.creator) }, collection_name: { _eq: identity.collection },
          },
        },
      };
  const response = await fetch(indexerUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: ownershipQuery, variables: { where } }),
  });
  if (!response.ok) throw new NFTDiscoveryError('indexer-unavailable', `Indexer HTTP ${response.status}`);
  const body = await response.json() as { data?: { current_token_ownerships_v2?: unknown[] }; errors?: unknown[] };
  if (body.errors?.length || !body.data?.current_token_ownerships_v2) throw new NFTDiscoveryError('indexer-unavailable', 'Indexer GraphQL error');
  const result = normalizeOwnershipRows(body.data.current_token_ownerships_v2);
  return result.items.find((item) => encodeNFTIdentity(item.identity) === encodeNFTIdentity(identity)) ?? null;
}

const marketplaceCollectionSchema = z.object({
  collection_id: address,
  collection_name: z.string(),
  creator_address: address,
  token_standard: z.enum(['v1', 'v2']),
  uri: z.string(),
  description: z.string(),
  current_supply: integer,
  max_supply: integer.optional().nullable(),
  last_transaction_version: integer,
});

function collectionKey(row: z.infer<typeof marketplaceCollectionSchema>) {
  return row.token_standard === 'v2'
    ? `v2:${row.collection_id}`
    : `v1:${row.creator_address}:${row.collection_name}`;
}

export function normalizeCollectionRows(rows: readonly unknown[]): NormalizedCollection[] {
  const collections = new Map<string, NormalizedCollection>();
  for (const candidate of rows) {
    const parsed = marketplaceCollectionSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const row = parsed.data;
    const key = collectionKey(row);
    const previous = collections.get(key);
    if (previous && BigInt(previous.lastTransactionVersion) >= BigInt(row.last_transaction_version)) continue;
    collections.set(key, {
      key,
      standard: row.token_standard,
      collectionId: row.collection_id,
      name: row.collection_name,
      creator: row.creator_address,
      description: row.description,
      metadataUri: row.uri,
      currentSupply: row.current_supply,
      maxSupply: row.max_supply ?? null,
      lastTransactionVersion: row.last_transaction_version,
    });
  }
  return [...collections.values()];
}

const collectionsQuery = `query marketplaceCollections($where: current_collections_v2_bool_exp!, $limit: Int!) {
  current_collections_v2(where:$where,limit:$limit) {
    collection_id collection_name creator_address token_standard uri description
    current_supply max_supply last_transaction_version
  }
}`;

const collectionOwnershipsQuery = `query marketplaceCollectionItems($where: current_token_ownerships_v2_bool_exp!, $limit: Int!) {
  current_token_ownerships_v2(where:$where,order_by:[{last_transaction_version:desc}],limit:$limit) {
    token_standard token_data_id property_version_v1 owner_address last_transaction_version amount is_soulbound_v2
    current_token_data { collection_id description token_data_id token_name token_standard token_uri maximum token_properties
      current_royalty_v1 { payee_address royalty_points_numerator royalty_points_denominator }
      current_collection { collection_id collection_name creator_address token_standard uri } }
  }
}`;

async function queryIndexer<T>(indexerUrl: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(indexerUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new NFTDiscoveryError('indexer-unavailable', `Indexer HTTP ${response.status}`);
  const body = await response.json() as { data?: T; errors?: unknown[] };
  if (body.errors?.length || !body.data) throw new NFTDiscoveryError('indexer-unavailable', 'Indexer GraphQL error');
  return body.data;
}

/** Resolve a bounded set of collection identities in one Indexer request. */
export async function discoverCollectionsByIdentity(
  indexerUrl: string,
  identities: readonly CollectionIdentity[],
): Promise<NormalizedCollection[]> {
  if (!identities.length) return [];
  const unique = identities.slice(0, 100).map((identity) => identity.standard === 'v2'
    ? { token_standard: { _eq: 'v2' }, collection_id: { _eq: canonical(identity.collectionId) } }
    : {
        token_standard: { _eq: 'v1' }, creator_address: { _eq: canonical(identity.creator) },
        collection_name: { _eq: identity.name },
      });
  const data = await queryIndexer<{ current_collections_v2?: unknown[] }>(indexerUrl, collectionsQuery, {
    where: { _or: unique }, limit: unique.length,
  });
  if (!data.current_collections_v2) throw new NFTDiscoveryError('indexer-unavailable', 'Indexer collection data is unavailable');
  return normalizeCollectionRows(data.current_collections_v2);
}

/** Load current owners and NFT metadata for one collection without per-item requests. */
export async function discoverCollectionNFTs(
  indexerUrl: string,
  identity: CollectionIdentity,
  limit = 100,
): Promise<NFTDiscoveryResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit must be 1..100');
  const collectionWhere = identity.standard === 'v2'
    ? { collection_id: { _eq: canonical(identity.collectionId) } }
    : { creator_address: { _eq: canonical(identity.creator) }, collection_name: { _eq: identity.name } };
  const data = await queryIndexer<{ current_token_ownerships_v2?: unknown[] }>(indexerUrl, collectionOwnershipsQuery, {
    where: {
      amount: { _gt: 0 }, token_standard: { _eq: identity.standard },
      current_token_data: { current_collection: collectionWhere },
    },
    limit,
  });
  if (!data.current_token_ownerships_v2) throw new NFTDiscoveryError('indexer-unavailable', 'Indexer collection inventory is unavailable');
  return { ...normalizeOwnershipRows(data.current_token_ownerships_v2), pages: 1 };
}
