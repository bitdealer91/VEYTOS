import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, timestamp, boolean, integer, numeric, jsonb,
  uniqueIndex, index, check, primaryKey, foreignKey, type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const network = pgEnum("network", ["devnet", "testnet", "mainnet"]);
export const role = pgEnum("role", ["user", "moderator", "admin"]);
export const reportReason = pgEnum("report_reason", ["scam", "copyright", "impersonation", "malicious_link", "other"]);
export const reportStatus = pgEnum("report_status", ["open", "reviewed", "dismissed"]);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const u64 = (name: string) => numeric(name, { precision: 20, scale: 0 });
const u64Check = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} BETWEEN 0 AND 18446744073709551615`);

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  role: role().notNull().default("user"),
  createdAt: createdAt(),
}, (t) => [check("user_address_format", sql`${t.walletAddress} ~ '^0x[0-9a-f]{64}$'`)]);

export const creatorProfiles = pgTable("creator_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  displayName: text("display_name"), bio: text(), imageUri: text("image_uri"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionDrafts = pgTable("collection_drafts", {
  id: uuid().defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").notNull().references(() => users.id),
  network: network().notNull(), config: jsonb().notNull(),
  manifestUri: text("manifest_uri"),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  uploadedCount: integer("uploaded_count").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("draft_creator_idx").on(t.creatorId), check("uploaded_count_nonnegative", sql`${t.uploadedCount} >= 0`)]);

export const collections = pgTable("collections", {
  id: uuid().defaultRandom().primaryKey(), network: network().notNull(),
  address: text().notNull(), authorityAddress: text("authority_address").notNull(),
  creatorAddress: text("creator_address").notNull(),
  slug: text().notNull().unique(), name: text().notNull(), description: text().notNull(),
  metadataUri: text("metadata_uri").notNull(), logoUri: text("logo_uri"), bannerUri: text("banner_uri"),
  transactionHash: text("transaction_hash").notNull(),
  verified: boolean().notNull().default(false), hidden: boolean().notNull().default(false),
  featured: boolean().notNull().default(false), createdAt: createdAt(),
}, (t) => [
  uniqueIndex("collection_chain_identity").on(t.network, t.address),
  uniqueIndex("collection_id_network").on(t.id, t.network),
  index("collection_creator_idx").on(t.network, t.creatorAddress),
  check("collection_address_format", sql`${t.address} ~ '^0x[0-9a-f]{64}$' AND ${t.authorityAddress} ~ '^0x[0-9a-f]{64}$' AND ${t.creatorAddress} ~ '^0x[0-9a-f]{64}$'`),
  check("collection_hash_format", sql`${t.transactionHash} ~ '^0x[0-9a-f]{64}$'`),
]);

export const drops = pgTable("drops", {
  id: uuid().defaultRandom().primaryKey(),
  network: network().notNull(),
  collectionId: uuid("collection_id").notNull().unique().references(() => collections.id),
  address: text().notNull(), priceOctas: u64("price_octas").notNull(),
  maxSupply: u64("max_supply").notNull(), minted: u64("minted").notNull().default("0"),
  walletLimit: u64("wallet_limit").notNull(), transactionLimit: u64("transaction_limit").notNull(),
  startSeconds: u64("start_seconds").notNull(), endSeconds: u64("end_seconds"),
  royaltyBps: integer("royalty_bps").notNull(), feeBps: integer("fee_bps").notNull(),
  creatorPaused: boolean("creator_paused").notNull().default(false),
  adminPaused: boolean("admin_paused").notNull().default(false),
  indexedVersion: u64("indexed_version").notNull(),
}, (t) => [
  uniqueIndex("drop_id_network").on(t.id, t.network),
  uniqueIndex("drop_chain_identity").on(t.network, t.address),
  foreignKey({ columns: [t.collectionId, t.network], foreignColumns: [collections.id, collections.network] }),
  u64Check("drop_price_u64", t.priceOctas), u64Check("drop_supply_u64", t.maxSupply),
  u64Check("drop_start_u64", t.startSeconds), u64Check("drop_end_u64", t.endSeconds),
  u64Check("drop_version_u64", t.indexedVersion),
  check("drop_supply_bounds", sql`${t.maxSupply} > 0 AND ${t.minted} BETWEEN 0 AND ${t.maxSupply}`),
  check("drop_limit_bounds", sql`${t.transactionLimit} > 0 AND ${t.transactionLimit} <= ${t.walletLimit} AND ${t.walletLimit} <= ${t.maxSupply}`),
  check("drop_schedule", sql`${t.endSeconds} IS NULL OR ${t.endSeconds} > ${t.startSeconds}`),
  check("drop_fee_bounds", sql`${t.feeBps} BETWEEN 0 AND 1000 AND ${t.royaltyBps} BETWEEN 0 AND 10000`),
  check("drop_address_format", sql`${t.address} ~ '^0x[0-9a-f]{64}$'`),
]);

export const mints = pgTable("mints", {
  id: uuid().defaultRandom().primaryKey(), network: network().notNull(),
  dropId: uuid("drop_id").notNull().references(() => drops.id),
  tokenAddress: text("token_address").notNull(), serial: u64("serial").notNull(),
  minterAddress: text("minter_address").notNull(), transactionHash: text("transaction_hash").notNull(),
  transactionVersion: u64("transaction_version").notNull(), eventIndex: integer("event_index").notNull(),
  priceOctas: u64("price_octas").notNull(), feeOctas: u64("fee_octas").notNull(),
  creatorRevenueOctas: u64("creator_revenue_octas").notNull(),
  chainTimestamp: timestamp("chain_timestamp", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("mint_event_identity").on(t.network, t.transactionVersion, t.eventIndex),
  foreignKey({ columns: [t.dropId, t.network], foreignColumns: [drops.id, drops.network] }),
  uniqueIndex("mint_token_identity").on(t.network, t.tokenAddress),
  uniqueIndex("mint_serial_identity").on(t.dropId, t.serial),
  index("mint_drop_idx").on(t.dropId, t.transactionVersion),
  index("mint_minter_idx").on(t.network, t.minterAddress),
  u64Check("mint_price_u64", t.priceOctas), u64Check("mint_fee_u64", t.feeOctas),
  u64Check("mint_revenue_u64", t.creatorRevenueOctas), u64Check("mint_version_u64", t.transactionVersion),
  u64Check("mint_serial_u64", t.serial),
  check("mint_serial_positive", sql`${t.serial} > 0`),
  check("mint_event_index_nonnegative", sql`${t.eventIndex} >= 0`),
  check("mint_conservation", sql`${t.priceOctas} = ${t.feeOctas} + ${t.creatorRevenueOctas}`),
  check("mint_address_format", sql`${t.tokenAddress} ~ '^0x[0-9a-f]{64}$' AND ${t.minterAddress} ~ '^0x[0-9a-f]{64}$' AND ${t.transactionHash} ~ '^0x[0-9a-f]{64}$'`),
]);

export const socialLinks = pgTable("social_links", {
  id: uuid().defaultRandom().primaryKey(), collectionId: uuid("collection_id").notNull().references(() => collections.id),
  kind: text().notNull(), url: text().notNull(),
}, (t) => [uniqueIndex("social_collection_kind").on(t.collectionId, t.kind), check("social_kind", sql`${t.kind} IN ('website','x','discord')`)]);

export const collectionReports = pgTable("collection_reports", {
  id: uuid().defaultRandom().primaryKey(), collectionId: uuid("collection_id").notNull().references(() => collections.id),
  reporterId: uuid("reporter_id").references(() => users.id), reason: reportReason().notNull(),
  details: text(), status: reportStatus().notNull().default("open"), createdAt: createdAt(),
});

export const moderationActions = pgTable("moderation_actions", {
  id: uuid().defaultRandom().primaryKey(), actorId: uuid("actor_id").notNull().references(() => users.id),
  collectionId: uuid("collection_id").notNull().references(() => collections.id),
  action: text().notNull(), reason: text().notNull(), createdAt: createdAt(),
});

export const platformConfig = pgTable("platform_config", {
  network: network().primaryKey(), settings: jsonb().notNull(),
  indexedVersion: u64("indexed_version"), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const indexerCheckpoints = pgTable("indexer_checkpoints", {
  network: network().notNull(), processor: text().notNull(), nextVersion: u64("next_version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.network, t.processor] }), u64Check("checkpoint_u64", t.nextVersion)]);

export const authChallenges = pgTable("auth_challenges", {
  id: uuid().defaultRandom().primaryKey(), nonceHash: text("nonce_hash").notNull().unique(),
  domain: text().notNull(), uri: text().notNull(), network: network().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }), createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: createdAt(),
}, (t) => [index("session_user_idx").on(t.userId)]);
