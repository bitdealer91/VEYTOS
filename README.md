# Mintos

The NFT home of Aptos.

A creator-first NFT launchpad: configure a collection, publish immutable assets,
launch on Aptos, and let collectors mint through their wallets. Secondary trading
is Phase 2 and is deliberately outside the current implementation.

## Current status

**Phase 1A / Gate A passed on Aptos testnet.** The contract core is implemented;
the browser product and mainnet security gates remain incomplete.

Implemented:

- Architecture, authority model, research references and implementation milestones.
- npm TypeScript workspaces with strict type checking and a reproducible lockfile.
- PostgreSQL/Drizzle schema and generated SQL migration for 13 entities.
- Exact APT/octas conversion, checked primary-sale quotes and metadata validation.
- Provider-neutral storage interface (real IPFS adapter is still pending).
- Move fee administration: initial 5%, maximum 10%, configurable treasury,
  two-step admin rotation, pause state, events and checked arithmetic.
- Native Digital Asset collection creation, staged metadata, immutable launch terms,
  lifetime supply/wallet limits, pause controls, royalties and atomic APT settlement.
- 82 passing Move tests and 13 passing TypeScript tests; normal type checking
  includes the testnet operator scripts.
- Real testnet publication and two-NFT mint, verified owner/counters/events and
  exact 5% payment split. See [TESTNET_ACCEPTANCE.md](TESTNET_ACCEPTANCE.md).

Not implemented yet: browser wallet integration, frontend, storage uploads,
authenticated routes, indexer, dashboard, admin UI or historical NFT discovery.
Acceptance uses three disposable SDK-controlled testnet wallets. Database migrations
have been generated, but not applied to a PostgreSQL instance here.

## Architecture and stack

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the full design, standards decisions,
data model, repository layout, security boundaries and open validation gates.

Target: Next.js/React/TypeScript, Tailwind, TanStack Query, Aptos Move, official
Aptos SDK and Wallet Adapter, PostgreSQL/Drizzle, and replaceable IPFS storage.
Next.js and wallet integration belong to Phase 1C after Phase 1B discovery research.
Branding lives in `packages/config/src/index.ts`; UI code must import it rather
than embedding the working name.

## Local setup

Use Node.js 22 or newer and npm. Node 24 was used for this milestone.

```sh
npm ci
cp .env.example .env
npm run check
```

There is no web development server yet. `npm run dev` and `npm run build` will be
added with the frontend milestone; no placeholder command pretends to build an app.

### Move setup

Install the [official Aptos CLI](https://aptos.dev/build/cli/install-cli/install-cli-mac).
CLI 9.6.0 was used for local verification. If it is not on PATH, export its path:

```sh
export APTOS_CLI=/absolute/path/to/aptos
npm run move:compile
npm run move:test
```

These scripts use `--dev` and the package's development address `0xcafe`. That
address is test-only, not a deployed contract. The package pins official framework
dependencies to commit `1b116b414ccc1d860fa72160d9b9a770e8d8e88f`. First compilation
downloads dependencies into the CLI's Move cache and requires network access.
Never use development address substitution for an actual deployment.

Fee policy stores configuration and quotes; launchpad enforces pauses and the
protected drop fee snapshot. Minting transfers APT directly to creator/treasury
and creates native NFTs atomically. No custody or withdrawal facility is retained.

### Database

Provide a local or managed PostgreSQL URL in `.env`, then:

```sh
npm run db:generate
npm run db:migrate
```

Inspect generated SQL before applying it to a shared environment. Migration scripts
use the server-only `DATABASE_URL`; no credentials are supplied in source. All chain
amounts/versions use decimal integer strings and SQL numeric(20,0), not JavaScript
numbers or signed PostgreSQL bigint. Monetary bounds, conservation, address format,
network relationships and event uniqueness have database constraints.

## Environment variables

`.env.example` documents current operator inputs and reserved application inputs.
Browser, indexer, storage and authentication variables are reserved for later phases.

- `APTOS_NETWORK`: server network, one of testnet/devnet/mainnet. Must match browser.
- `NEXT_PUBLIC_APTOS_NETWORK`: public network; defaults to testnet.
- `NEXT_PUBLIC_LAUNCHPAD_ADDRESS`: real published module address; no development
  fallback. Mainnet configuration fails without a nonzero address.
- `LAUNCHPAD_DEPLOYMENT_VERSION`: first version for complete indexer backfill.
- `APTOS_FULLNODE_URL`, `APTOS_INDEXER_URL`: optional server endpoint overrides.
- `APTOS_API_KEY`: optional server-only RPC credential.
- `NEXT_PUBLIC_APP_URL`: public origin for auth and sharing. Mainnet requires HTTPS.
- `DATABASE_URL`: server-only PostgreSQL DSN for migrations and product storage.
- `IPFS_API_URL`, `IPFS_API_TOKEN`: server-only upload endpoint and credential.
- `NEXT_PUBLIC_IPFS_GATEWAY`: public retrieval gateway; content URIs stay `ipfs://`.
- `NEXT_PUBLIC_APTOS_CONNECT_DAPP_ID`: optional public Aptos Connect identifier.
- `APTOS_CLI`: executable path for local Move scripts; defaults to `aptos`.
- `MINTOS_TESTNET_ACCOUNTS_FILE`: operator-only absolute path to disposable
  account JSON outside this repository; owner-only permissions are required.
  This variable contains a path, never key material.

Next.js replaces public variables at build time; network/address changes require a
new frontend build. Never expose private RPC/storage keys with a NEXT_PUBLIC prefix.
There is no environment private key or application backend wallet signing feature.
The testnet-only operator tool loads disposable keys from the external file.

## Testing and evidence

```sh
npm run check
npm run move:test
npm run move:compile
npm run db:generate
npm audit
```

[docs/MILESTONE_1.md](docs/MILESTONE_1.md) is the historical foundation checkpoint.
[TESTNET_ACCEPTANCE.md](TESTNET_ACCEPTANCE.md) and its linked machine-readable
evidence record the current contract acceptance. Move tests live in
`move/launchpad/tests` and module-local test functions.

Drizzle's legacy development loader brings an old esbuild dependency. A targeted
override pins that loader to esbuild 0.25.12; migration generation was verified after
the override. Do not remove it without rechecking the advisory and tooling. This
override does not change the separate tsx esbuild dependency.

## Testnet deployment and acceptance

```sh
export APTOS_NETWORK=testnet
export NEXT_PUBLIC_APTOS_NETWORK=testnet
export MINTOS_TESTNET_ACCOUNTS_FILE="$HOME/.local/share/mintos/testnet/accounts.json"
export APTOS_CLI=/absolute/path/to/aptos
npm run testnet:accounts
# Fund the printed admin address with at least 5 TESTNET APT via the official faucet.
npm run testnet:preflight
npm run testnet:acceptance
```

The tool enforces testnet chain ID 2 and the official fullnode. It validates
distinct admin/creator/buyer identities, binds the package address to the publisher,
uses the admin as this test's treasury, and rejects conflicting environment values.
It runs TypeScript checks and Move tests, compiles production sources with the real
publisher address, publishes, checks bytecode, initializes fees, funds the creator
with 3 APT and buyer with 1 APT, creates 100 metadata entries and mints two NFTs.
The creator funds pay real storage costs. Future application treasury configuration
is not coupled to this disposable testnet choice.

`.testnet/journal.json` stores transaction hashes and signed bytes before submission,
never private keys. A resume reconciles those hashes; only HTTP 404 permits sending
the identical signed bytes again. Other errors fail closed. Failed or expired
transactions are not automatically re-signed. See the recovery instructions and
recorded out-of-gas deviation in [TESTNET_ACCEPTANCE.md](TESTNET_ACCEPTANCE.md).
Do not delete the journal to retry a mint. A run lock prevents concurrent operators.

The creator website creates a collection under the existing package; creators do
not publish Move packages or run CLI commands. Deployment tooling is for operators.
Set the real module address in the environment only after on-chain verification.
Use testnet for persistent integration; devnet is disposable development state.

Gate A verifies committed transactions and native state using the SDK. Its local,
content-addressed metadata fixtures are not publicly pinned. Browser wallet and
public storage acceptance remain Phase 1C work.

## Frontend and worker deployment plan

After implementation, build `apps/web` on Vercel with public network/address/origin
and server-only database/storage configuration. Run migrations as an explicit release
step. Deploy `apps/indexer` as a Node worker with a durable PostgreSQL checkpoint and
the verified deployment version. Keep long-running indexing outside request handlers.
Scheduled jobs must never infer success from a browser-submitted hash without chain
verification. Provider-specific deployment recipes follow the tested integration.

## Security and mainnet

Read [SECURITY.md](SECURITY.md) and [MAINNET_CHECKLIST.md](MAINNET_CHECKLIST.md).
The current package has compatible upgrades for testnet development. Mainnet
requires reviewed immutable publication, secured multisig configuration and all
acceptance gates. No mainnet deployment has been performed or is implied.

## Next milestone

Phase 1B: research actual Token V1/V2 collections and implement verified wallet NFT
discovery. No outstanding Gate A blocker prevents that work; it was deliberately
not started in this milestone. Frontend is Phase 1C and marketplace is Phase 2.
