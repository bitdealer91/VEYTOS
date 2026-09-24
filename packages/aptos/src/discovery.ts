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

const ownershipQuery = `query nft($where: current_token_ownerships_v2_bool_exp!) {
  current_token_ownerships_v2(where:$where,order_by:[{last_transaction_version:desc}],limit:20) {
    token_standard token_data_id property_version_v1 owner_address last_transaction_version amount
    current_token_data { collection_id description token_data_id token_name token_standard token_uri maximum token_properties
      current_royalty_v1 { payee_address royalty_points_numerator royalty_points_denominator }
      current_collection { collection_id collection_name creator_address token_standard uri } }
  }
}`;

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
