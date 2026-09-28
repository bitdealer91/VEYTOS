CREATE TYPE "public"."network" AS ENUM('devnet', 'testnet', 'mainnet');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('scam', 'copyright', 'impersonation', 'malicious_link', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce_hash" text NOT NULL,
	"domain" text NOT NULL,
	"uri" text NOT NULL,
	"network" "network" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_challenges_nonce_hash_unique" UNIQUE("nonce_hash")
);
--> statement-breakpoint
CREATE TABLE "collection_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"config" jsonb NOT NULL,
	"manifest_uri" text,
	"validated_at" timestamp with time zone,
	"uploaded_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploaded_count_nonnegative" CHECK ("collection_drafts"."uploaded_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "collection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" "network" NOT NULL,
	"address" text NOT NULL,
	"authority_address" text NOT NULL,
	"creator_address" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"metadata_uri" text NOT NULL,
	"logo_uri" text,
	"banner_uri" text,
	"transaction_hash" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug"),
	CONSTRAINT "collection_address_format" CHECK ("collections"."address" ~ '^0x[0-9a-f]{64}$' AND "collections"."authority_address" ~ '^0x[0-9a-f]{64}$' AND "collections"."creator_address" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "collection_hash_format" CHECK ("collections"."transaction_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"bio" text,
	"image_uri" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" "network" NOT NULL,
	"collection_id" uuid NOT NULL,
	"address" text NOT NULL,
	"price_octas" numeric(20, 0) NOT NULL,
	"max_supply" numeric(20, 0) NOT NULL,
	"minted" numeric(20, 0) DEFAULT '0' NOT NULL,
	"wallet_limit" numeric(20, 0) NOT NULL,
	"transaction_limit" numeric(20, 0) NOT NULL,
	"start_seconds" numeric(20, 0) NOT NULL,
	"end_seconds" numeric(20, 0),
	"royalty_bps" integer NOT NULL,
	"fee_bps" integer NOT NULL,
	"creator_paused" boolean DEFAULT false NOT NULL,
	"admin_paused" boolean DEFAULT false NOT NULL,
	"indexed_version" numeric(20, 0) NOT NULL,
	CONSTRAINT "drops_collection_id_unique" UNIQUE("collection_id"),
	CONSTRAINT "drop_price_u64" CHECK ("drops"."price_octas" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "drop_supply_u64" CHECK ("drops"."max_supply" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "drop_start_u64" CHECK ("drops"."start_seconds" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "drop_end_u64" CHECK ("drops"."end_seconds" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "drop_version_u64" CHECK ("drops"."indexed_version" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "drop_supply_bounds" CHECK ("drops"."max_supply" > 0 AND "drops"."minted" BETWEEN 0 AND "drops"."max_supply"),
	CONSTRAINT "drop_limit_bounds" CHECK ("drops"."transaction_limit" > 0 AND "drops"."transaction_limit" <= "drops"."wallet_limit" AND "drops"."wallet_limit" <= "drops"."max_supply"),
	CONSTRAINT "drop_schedule" CHECK ("drops"."end_seconds" IS NULL OR "drops"."end_seconds" > "drops"."start_seconds"),
	CONSTRAINT "drop_fee_bounds" CHECK ("drops"."fee_bps" BETWEEN 0 AND 1000 AND "drops"."royalty_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "drop_address_format" CHECK ("drops"."address" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "indexer_checkpoints" (
	"network" "network" NOT NULL,
	"processor" text NOT NULL,
	"next_version" numeric(20, 0) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indexer_checkpoints_network_processor_pk" PRIMARY KEY("network","processor"),
	CONSTRAINT "checkpoint_u64" CHECK ("indexer_checkpoints"."next_version" BETWEEN 0 AND 18446744073709551615)
);
--> statement-breakpoint
CREATE TABLE "mints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" "network" NOT NULL,
	"drop_id" uuid NOT NULL,
	"token_address" text NOT NULL,
	"serial" numeric(20, 0) NOT NULL,
	"minter_address" text NOT NULL,
	"transaction_hash" text NOT NULL,
	"transaction_version" numeric(20, 0) NOT NULL,
	"event_index" integer NOT NULL,
	"price_octas" numeric(20, 0) NOT NULL,
	"fee_octas" numeric(20, 0) NOT NULL,
	"creator_revenue_octas" numeric(20, 0) NOT NULL,
	"chain_timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mint_price_u64" CHECK ("mints"."price_octas" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "mint_fee_u64" CHECK ("mints"."fee_octas" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "mint_revenue_u64" CHECK ("mints"."creator_revenue_octas" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "mint_version_u64" CHECK ("mints"."transaction_version" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "mint_serial_u64" CHECK ("mints"."serial" BETWEEN 0 AND 18446744073709551615),
	CONSTRAINT "mint_serial_positive" CHECK ("mints"."serial" > 0),
	CONSTRAINT "mint_event_index_nonnegative" CHECK ("mints"."event_index" >= 0),
	CONSTRAINT "mint_conservation" CHECK ("mints"."price_octas" = "mints"."fee_octas" + "mints"."creator_revenue_octas"),
	CONSTRAINT "mint_address_format" CHECK ("mints"."token_address" ~ '^0x[0-9a-f]{64}$' AND "mints"."minter_address" ~ '^0x[0-9a-f]{64}$' AND "mints"."transaction_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"network" "network" PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"indexed_version" numeric(20, 0),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "social_kind" CHECK ("social_links"."kind" IN ('website','x','discord'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "user_address_format" CHECK ("users"."wallet_address" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_id_network" ON "collections" USING btree ("id","network");
--> statement-breakpoint
CREATE UNIQUE INDEX "drop_id_network" ON "drops" USING btree ("id","network");
--> statement-breakpoint
ALTER TABLE "collection_drafts" ADD CONSTRAINT "collection_drafts_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_collection_id_network_collections_id_network_fk" FOREIGN KEY ("collection_id","network") REFERENCES "public"."collections"("id","network") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mints" ADD CONSTRAINT "mints_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mints" ADD CONSTRAINT "mints_drop_id_network_drops_id_network_fk" FOREIGN KEY ("drop_id","network") REFERENCES "public"."drops"("id","network") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draft_creator_idx" ON "collection_drafts" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_chain_identity" ON "collections" USING btree ("network","address");--> statement-breakpoint
CREATE INDEX "collection_creator_idx" ON "collections" USING btree ("network","creator_address");--> statement-breakpoint
CREATE UNIQUE INDEX "drop_chain_identity" ON "drops" USING btree ("network","address");--> statement-breakpoint
CREATE UNIQUE INDEX "mint_event_identity" ON "mints" USING btree ("network","transaction_version","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "mint_token_identity" ON "mints" USING btree ("network","token_address");--> statement-breakpoint
CREATE UNIQUE INDEX "mint_serial_identity" ON "mints" USING btree ("drop_id","serial");--> statement-breakpoint
CREATE INDEX "mint_drop_idx" ON "mints" USING btree ("drop_id","transaction_version");--> statement-breakpoint
CREATE INDEX "mint_minter_idx" ON "mints" USING btree ("network","minter_address");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_collection_kind" ON "social_links" USING btree ("collection_id","kind");
