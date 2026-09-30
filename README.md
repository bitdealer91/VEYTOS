# VEYTOS

The NFT home of Aptos.

An Aptos-native NFT launchpad and fixed-price marketplace for current Digital Assets
and historical Token V1 collections.

## Current status

**Phase 1A, Phase 1B, and Phase 2C passed their Aptos testnet gates.** The launchpad,
Token V1/V2 discovery, fixed-price marketplace contracts, and browser List/Cancel/Buy
flows are verified on testnet. Phase 3A prepares the public testnet beta; mainnet
security gates and an external audit remain incomplete.

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
- 182 passing Move tests plus current TypeScript/Node and frontend regression suites;
  normal type checking includes the testnet operator and indexer scripts.
- Real testnet publication and two-NFT mint, verified owner/counters/events and
  exact 5% payment split. See [TESTNET_ACCEPTANCE.md](TESTNET_ACCEPTANCE.md).
- Official Indexer discovery for Token V1 and V2, with strict normalization,
  complete pagination, deduplication and a read-only wallet profile.
- Browser wallet mint and committed-version ownership reconciliation. See
  [frontend evidence](docs/evidence/frontend-browser-mint.json).

Not implemented yet: creator storage uploads, creator dashboard, admin UI, offers,
auctions, or mainnet deployment. Marketplace browsing requires the durable PostgreSQL
projection worker documented in [public beta operations](docs/PUBLIC_BETA_OPERATIONS.md).
Acceptance uses three disposable SDK-controlled testnet wallets. Database migrations
have been generated, but not applied to a PostgreSQL instance here.

## Architecture and stack

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the full design, standards decisions,
data model, repository layout, security boundaries and open validation gates.

Stack: Next.js/React/TypeScript, Tailwind, TanStack Query, Aptos Move, official
Aptos SDK and Wallet Adapter, PostgreSQL/Drizzle, and replaceable IPFS storage.
Branding lives in `packages/config/src/index.ts`; UI code must import it rather
than embedding the working name.

## Local setup

Use Node.js 22 or newer and npm. Node 24 was used for this milestone.

```sh
npm ci
cp .env.example .env
npm run dev
npm run check
```

Copy `apps/web/.env.example` to `apps/web/.env.local` for the browser application.
`npm run dev` starts Next.js and `npm run build` performs the production webpack build.

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

`.env.example` documents current operator inputs and application inputs. Public beta
browser, indexer, storage, and worker variables are also listed in
`apps/web/.env.example`; private provider credentials remain server-only.

- `APTOS_NETWORK`: server network, one of testnet/devnet/mainnet. Must match browser.
- `NEXT_PUBLIC_APTOS_NETWORK`: public network; defaults to testnet.
- `NEXT_PUBLIC_LAUNCHPAD_ADDRESS`: real published module address; no development
  fallback. Mainnet configuration fails without a nonzero address.
- `BETA_INDEXER_START_VERSION`: first version for complete launchpad and marketplace backfill.
- `APTOS_FULLNODE_URL`, `APTOS_INDEXER_URL`: optional server endpoint overrides.
- `APTOS_API_KEY`, `APTOS_INDEXER_API_KEY`: optional server-only provider credentials.
- `NEXT_PUBLIC_APTOS_FULLNODE_URL`: optional browser-safe RPC endpoint override.
  It must not contain a secret credential; private managed-provider keys stay in
  `APTOS_API_KEY` and are used only by server-side Aptos reads.
- `NEXT_PUBLIC_APP_URL`: public origin for auth and sharing. Mainnet requires HTTPS.
- `DATABASE_URL`: server-only PostgreSQL DSN for migrations and product storage.
- `IPFS_API_URL`, `IPFS_API_TOKEN`: server-only upload endpoint and credential.
- `NEXT_PUBLIC_IPFS_GATEWAY`: public retrieval gateway; content URIs stay `ipfs://`.
- `VEYTOS_FEATURED_DROPS` / `VEYTOS_HIDDEN_DROPS`: optional ordered public
  launchpad curation; every configured address is still resolved and verified
  through the Aptos launchpad view before rendering.
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
npm run mainnet:nft-smoke
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
content-addressed metadata fixtures are not publicly pinned. Browser wallet
acceptance is recorded; public storage acceptance remains future work.

## Frontend and worker deployment

Build `apps/web` on Vercel or another Node-compatible HTTPS host with the public
network/address/origin and server-only database configuration. Run migrations as an
explicit release step. Deploy `Dockerfile.indexer` as a continuously supervised worker.
It resumes from a durable PostgreSQL checkpoint, verifies successful transactions,
and writes duplicate-safe marketplace and launchpad projections. Long-running indexing
stays outside request handlers and never authorizes a trade. See
[PUBLIC_BETA_OPERATIONS.md](docs/PUBLIC_BETA_OPERATIONS.md).

## Security and mainnet

Read [SECURITY.md](SECURITY.md) and [MAINNET_CHECKLIST.md](MAINNET_CHECKLIST.md).
The current package has compatible upgrades for testnet development. Mainnet
requires reviewed immutable publication, secured multisig configuration and all
acceptance gates. No mainnet deployment has been performed or is implied.

## Next milestone

Deploy the Phase 3A web service, durable worker, and PostgreSQL projection to a public
HTTPS testnet environment. Run the clean-browser public beta smoke gate before inviting
external testers. Mainnet remains blocked on an external contract security review.
