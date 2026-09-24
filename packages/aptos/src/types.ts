export type TokenIdentity = { standard: 'v2'; address: string } | { standard: 'v1'; creator: string; collection: string; name: string; propertyVersion: string };
export type Drop = {
  address: string; collection: string; finalized: boolean; creator_paused: boolean; admin_paused: boolean;
  uploaded: string; minted: string;
  terms: { creator: string; name: string; description: string; collection_uri: string; max_supply: string; unit_price: string; wallet_limit: string; transaction_limit: string; start_seconds: string; end_seconds: string; royalty_bps: string; fee_bps: string };
};
export type MintEvent = { token: string; collection: string; drop: string; buyer: string; creator: string; treasury: string; serial: string; unit_price: string; fee: string; creator_revenue: string; timestamp: string };
export type Activity = MintEvent & { hash: string; version: string };
export type Asset = { identity: TokenIdentity; address: string; name: string; uri: string; owner: string; collection: string };
export type TransactionPhase = 'ready' | 'review' | 'wallet' | 'submitted' | 'confirming' | 'success' | 'failure' | 'unknown';
export type PendingMint = { hash: string; sender: string; drop: string; quantity: number; unitPrice: string; network: string; module: string };
export type MarketplaceStandard = 'v1' | 'v2';
export type MarketplaceListing = {
  id: string;
  seller: string;
  standard: MarketplaceStandard;
  identity: TokenIdentity;
  collectionId: string;
  price: string;
  feeBps: string;
  storageReimbursement: string;
  royaltyPayee: string;
  royaltyNumerator: string;
  royaltyDenominator: string;
  status: 'ACTIVE' | 'CANCELLED' | 'SOLD';
};
export type MarketplaceConfig = {
  chainId: number;
  feeBps: string;
  recipient: string;
  globalPaused: boolean;
  v1Paused: boolean;
  v2Paused: boolean;
  admin: string;
  v1StorageReimbursement: string;
  v2StorageReimbursement: string;
};
export type MarketplaceEconomics = {
  price: bigint;
  fee: bigint;
  royalty: bigint;
  sellerProceeds: bigint;
  storageReimbursement: bigint;
  buyerTotalBeforeGas: bigint;
};
export type PendingMarketplaceTransaction = {
  action: 'list' | 'cancel' | 'buy';
  hash: string;
  sender: string;
  listingId?: string;
  identity: TokenIdentity;
  expectedPrice?: string;
  expectedStorageReimbursement?: string;
  network: string;
  module: string;
};
