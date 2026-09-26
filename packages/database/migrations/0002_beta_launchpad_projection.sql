CREATE TABLE "launchpad_events" (
  "network" "network" NOT NULL,
  "module_address" text NOT NULL,
  "transaction_version" numeric(20,0) NOT NULL,
  "event_index" integer NOT NULL,
  "transaction_hash" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "chain_timestamp" timestamp with time zone NOT NULL,
  CONSTRAINT "launchpad_events_network_module_address_transaction_version_event_index_pk" PRIMARY KEY("network","module_address","transaction_version","event_index"),
  CONSTRAINT "launchpad_event_version_u64" CHECK ("transaction_version" BETWEEN 0 AND 18446744073709551615)
);
--> statement-breakpoint
CREATE INDEX "launchpad_activity_version_idx" ON "launchpad_events" ("network","module_address","transaction_version");
