# VEYTOS public beta deployment checklist

This checklist deploys the verified VEYTOS contracts as an **Aptos Testnet Beta**. It does not publish or upgrade Move packages and requires no custody, admin, or wallet signing key.

## Repository-owned preparation

- [x] Next.js production configuration exists in `vercel.json`.
- [x] The continuously running worker is packaged by `Dockerfile.indexer`.
- [x] PostgreSQL migrations are ordered and tracked by Drizzle.
- [x] `npm run db:migrate` applies all schema migrations using the server-only `DATABASE_URL`.
- [x] `npm run db:verify` checks TLS, required projection tables, and public-safe projection counts without printing credentials.
- [x] `npm run deploy:preflight` additionally requires an indexer checkpoint and verifies the testnet fullnode, Aptos Indexer, and published launchpad/marketplace modules.
- [x] Production preflight rejects localhost URLs, network/address drift, plaintext database connections, and manual transaction/address discovery seeds.
- [x] The worker uses one PostgreSQL advisory lock, commits a batch with its checkpoint, handles SIGTERM, and restarts safely from `indexer_checkpoints`.

## Owner-provisioned dependencies

These steps require accounts, credentials, billing choices, or wallet approval owned by the VEYTOS operator. Values belong in provider secret stores, never Git.

- [ ] Create a Vercel project from the repository root. Keep the root directory at the monorepo root so workspace packages remain available. Configure production variables before deploying.
- [ ] Create managed PostgreSQL with backups and TLS. The web application needs an externally reachable TLS DSN ending in `sslmode=require` (or stronger). Restrict database ingress where the provider permits it.
- [ ] Create exactly one continuously supervised Docker worker. Give it the same database and chain configuration. Configure automatic restart and at least 30 seconds for graceful shutdown.
- [ ] Obtain managed Aptos Testnet fullnode and Indexer endpoints. Store server API keys only as `APTOS_API_KEY` and `APTOS_INDEXER_API_KEY`.
- [ ] Obtain browser-safe fullnode and Indexer endpoints without a secret credential. Set them through `NEXT_PUBLIC_APTOS_FULLNODE_URL` and `NEXT_PUBLIC_APTOS_INDEXER_URL`; every `NEXT_PUBLIC_*` value is visible to users.
- [ ] Supply the public HTTPS origin as `NEXT_PUBLIC_APP_URL` and a public issue-report URL.
- [ ] Provide two independent funded Aptos Testnet wallets and Petra/mobile wallet access for acceptance. Never upload keys to either deployment.

## Exact production variables

### Web application

`APTOS_NETWORK=testnet`, `NEXT_PUBLIC_APTOS_NETWORK=testnet`, `APTOS_FULLNODE_URL`, optional `APTOS_API_KEY`, `APTOS_INDEXER_URL`, optional `APTOS_INDEXER_API_KEY`, browser-safe `NEXT_PUBLIC_APTOS_FULLNODE_URL`, browser-safe `NEXT_PUBLIC_APTOS_INDEXER_URL`, `DATABASE_URL`, `NEXT_PUBLIC_LAUNCHPAD_ADDRESS`, `NEXT_PUBLIC_MARKETPLACE_ADDRESS`, `LAUNCHPAD_ADDRESS`, `MARKETPLACE_ADDRESS`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_IPFS_GATEWAY`, `NEXT_PUBLIC_ARWEAVE_GATEWAY`, and `NEXT_PUBLIC_FEEDBACK_URL`.

### Indexer worker

`APTOS_NETWORK=testnet`, `APTOS_FULLNODE_URL`, optional `APTOS_API_KEY`, `DATABASE_URL`, `LAUNCHPAD_ADDRESS`, `MARKETPLACE_ADDRESS`, `BETA_INDEXER_START_VERSION=11370375847`, and `INDEXER_POLL_INTERVAL_MS=3000`.

Do not set `VEYTOS_DISCOVERY_DROPS`, `VEYTOS_ACTIVITY_TXS`, or `VEYTOS_MARKETPLACE_TXS` in production. They are local diagnostics, not public discovery infrastructure.

## Deployment order

1. Provision PostgreSQL and set `DATABASE_URL` locally only for the migration session.
2. Run `npm run db:migrate`, followed by `npm run db:verify`.
3. Deploy one worker from `Dockerfile.indexer`. Start at ledger version `11370375847`, which precedes both verified testnet packages.
4. Confirm worker logs show advancing batches. Restart it once and confirm the checkpoint resumes without duplicate `marketplace_events` or `launchpad_events` rows.
5. Run `npm run deploy:preflight` with the production environment and `--require-checkpoint` behavior supplied by the script.
6. Deploy the web application from the repository root over HTTPS.
7. Confirm the visible banner says **Aptos Testnet Beta**, test assets only, and contracts unaudited.
8. Run clean-browser discovery and the two-wallet LIST → CANCEL and LIST → BUY acceptance flows.

## External beta gate evidence

Record the deployed commit and public URL; provider project/service identifiers without secrets; migration and preflight timestamps; checkpoint before/restart/after; LIST, CANCEL, relist, and BUY transaction hashes; NFT identity and final owner; exact fee, royalty, proceeds, and storage reimbursement; projection delay; mobile Petra result; analytics redaction result; and observed RPC 429 count.

Phase 3B remains incomplete until this evidence comes from the deployed HTTPS application.
