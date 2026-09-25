CREATE TABLE "marketplace_listings" (
  "network" "network" NOT NULL,
  "module_address" text NOT NULL,
  "listing_id" numeric(20,0) NOT NULL,
  "standard" text NOT NULL,
  "asset_key" text NOT NULL,
  "collection_key" text NOT NULL,
  "seller_address" text NOT NULL,
  "buyer_address" text,
  "price_octas" numeric(20,0) NOT NULL,
  "fee_bps" integer NOT NULL,
  "storage_reimbursement_octas" numeric(20,0) NOT NULL,
  "royalty_payee" text NOT NULL,
  "royalty_numerator" numeric(20,0) NOT NULL,
  "royalty_denominator" numeric(20,0) NOT NULL,
  "status" text NOT NULL,
  "listed_version" numeric(20,0) NOT NULL,
  "terminal_version" numeric(20,0),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketplace_listings_network_module_address_listing_id_pk" PRIMARY KEY("network","module_address","listing_id"),
  CONSTRAINT "marketplace_standard" CHECK ("standard" IN ('v1','v2')),
  CONSTRAINT "marketplace_status" CHECK ("status" IN ('ACTIVE','CANCELLED','SOLD')),
  CONSTRAINT "marketplace_fee_bounds" CHECK ("fee_bps" BETWEEN 0 AND 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_active_asset" ON "marketplace_listings" ("network","module_address","asset_key") WHERE "status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "marketplace_seller_idx" ON "marketplace_listings" ("network","module_address","seller_address","status");
--> statement-breakpoint
CREATE INDEX "marketplace_collection_idx" ON "marketplace_listings" ("network","module_address","collection_key","status");
--> statement-breakpoint
CREATE TABLE "marketplace_events" (
  "network" "network" NOT NULL,
  "module_address" text NOT NULL,
  "transaction_version" numeric(20,0) NOT NULL,
  "event_index" integer NOT NULL,
  "transaction_hash" text NOT NULL,
  "listing_id" numeric(20,0) NOT NULL,
  "event_type" text NOT NULL,
  "standard" text NOT NULL,
  "asset_key" text NOT NULL,
  "collection_key" text NOT NULL,
  "seller_address" text NOT NULL,
  "buyer_address" text,
  "gross_price_octas" numeric(20,0),
  "payload" jsonb NOT NULL,
  "chain_timestamp" timestamp with time zone NOT NULL,
  CONSTRAINT "marketplace_events_network_module_address_transaction_version_event_index_pk" PRIMARY KEY("network","module_address","transaction_version","event_index"),
  CONSTRAINT "marketplace_event_type" CHECK ("event_type" IN ('LISTED','CANCELLED','PURCHASED'))
);
--> statement-breakpoint
CREATE INDEX "marketplace_activity_listing_idx" ON "marketplace_events" ("network","module_address","listing_id");
--> statement-breakpoint
CREATE INDEX "marketplace_activity_collection_idx" ON "marketplace_events" ("network","module_address","collection_key","transaction_version");
