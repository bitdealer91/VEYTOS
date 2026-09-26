# Public testnet beta operations

VEYTOS beta is an **Aptos Testnet** service. Test assets and test APT have no real-world value. The contracts have testnet acceptance evidence but have not completed an external security audit.

## Deployment topology

- Deploy `apps/web` as a Node-compatible Next.js service behind HTTPS.
- Run `npm run indexer:marketplace` as one continuously supervised Node worker.
- Use managed PostgreSQL with backups and TLS. Apply `npm run db:migrate` once per release before starting the worker.
- Use managed Aptos fullnode and Indexer endpoints for server/worker reads. Keep `APTOS_API_KEY` and `APTOS_INDEXER_API_KEY` server-side. Browser-safe endpoints may be set separately only when their credentials are explicitly public.
- Aptos Indexer remains the ownership source for wallet discovery. The VEYTOS projection powers browsing and never authorizes List, Cancel, or Buy.

Required production variables are documented in `apps/web/.env.example`. `APTOS_NETWORK` and `NEXT_PUBLIC_APTOS_NETWORK` must both be `testnet`. Set the HTTPS deployment origin in `NEXT_PUBLIC_APP_URL`. `BETA_INDEXER_START_VERSION` is needed only when the durable checkpoint does not exist; it must cover both deployed packages.

`vercel.json` supplies the monorepo web build/output settings. `Dockerfile.indexer` is the portable worker image; deploy it to infrastructure with outbound HTTPS and PostgreSQL connectivity. The worker holds a PostgreSQL advisory lock keyed by network/module, so a second replica exits instead of racing the checkpoint.

## Worker recovery

The worker commits events, listing state, launchpad events, and its next ledger version in one database transaction. Inserts are conflict-safe. A crash rolls back the batch; restart the same command and processing resumes from `indexer_checkpoints`. Run only one worker per `(network, marketplace module)` until database advisory locking is added.

## Troubleshooting

- **RPC 429:** confirm the managed endpoint and key are present. Browser background errors preserve last-known state; transaction prechecks fail closed.
- **Indexer unavailable:** trading pages continue to use authoritative fullnode reads, while Explore and Activity show an unavailable/empty projection state.
- **Wallet error:** inspect the categorized browser error and wallet state. Never request a seed phrase.
- **Move abort:** use the transaction hash and module abort mapping. Do not retry an ambiguous transaction.
- **Reconciliation timeout:** retain the transaction hash and reconcile exact listing and ownership state. Never submit automatically.
- **Metadata failure:** confirm URI scheme, gateway health, content size, and JSON. A broken item must render fallback artwork.

Logs may include public transaction hashes, module addresses, HTTP status, and error categories. They must never include private keys, seed phrases, signing material, API keys, cookies, or full request headers.

## Release check

Run `npm test`, `npm run test:frontend`, `npm run typecheck`, `npm run build`, both Move suites, and `git diff --check`. Verify the banner says **Aptos Testnet Beta**, HTTPS is valid, the database checkpoint advances, and a clean-browser List → Buy flow appears in Explore and Activity without reload.
