# VEYTOS frontend v1

This milestone is explicitly authorised ahead of Phase 1B. Move modules, their
published names, fee rules and capability model remain unchanged.

Next.js App Router server components own page composition and initial chain reads.
React client islands own search/filter/view preferences, wallet adapter, countdowns
and transactions. Tailwind plus semantic CSS tokens supply the visual system.
TanStack Query caches live eligibility and marketplace state; no additional global
state library. The application creates one Aptos SDK client and one marketplace
read wrapper per runtime/network configuration.

packages/aptos contains serializable domain types, integer-safe eligibility,
transaction validation and the SDK read/payload layer. Token identity is a tagged
V1/V2 union. Phase 1B adds official Indexer ownership discovery for both standards,
while keeping the underlying identities distinct. No marketplace settlement is
implemented or implied. Existing domain money helpers remain canonical.

apps/web/src/lib owns validated public config and server-only discovery config.
Discovery uses an explicit, bounded list of drop addresses from operator environment,
then verifies each against the configured package and live chain. This curated seed
list is not an indexer or an exhaustive market inventory. Unconfigured deployments
show honest empty states; RPC failures show errors, never fake fallback rows.

Minting reads fresh terms, pauses, wallet counts and chain ID before signing, then
uses the official Aptos wallet adapter with explicit expected price/max total.
Submitted hashes are persisted per network/package/drop (the submitting wallet is recorded in the value) and reconciled from
committed receipts and native ownership. Timeouts remain unknown. A hash is never
accepted as success without sender, entry function, arguments and mint event checks.

Metadata stays canonical ipfs://; bounded reads only through the configured public
HTTPS gateway, no server-side arbitrary URI proxy. Missing/unpinned metadata leaves
a labelled fallback. Production has no test fixtures, local signer or private keys.

Implemented routes include /, /explore, /drops, /collection/[id], /activity,
/profile/[address] and /nft/[normalized-identity]. The NFT detail route supports
the verified testnet marketplace transaction flow; the profile uses current Indexer
holdings plus marketplace projections. Studio routes remain outside this milestone.

Marketplace detail reads are separated by volatility. The active-assets table
handle is cached for the runtime, fee/pause/storage configuration is cached for five
minutes, and the server-provided NFT asset snapshot prevents a duplicate hydration
read. Idle pages do not poll. Reconnect or a visible-tab transition may perform one
deduplicated asset refresh after the snapshot becomes stale. Wallet changes only
invalidate wallet eligibility/holdings; they do not refetch account-independent
listing data. LIST/CANCEL/BUY use fresh, narrowly scoped pause/listing/owner reads,
then receipt reconciliation writes the confirmed snapshot directly and marks broader
Indexer projections stale without synchronously refetching them.

Identical Aptos reads share one in-flight promise. HTTP 429 reads honor Retry-After
when supplied or retry at bounded 1s/2s exponential delays with jitter. Background
queries do not retry and keep their last good snapshot. A transaction precheck must
complete successfully before the wallet is called. Transaction ABI discovery is
handled by the wallet SDK's memoized ABI cache and is never part of an idle
marketplace refresh. Public and server-only fullnode overrides are documented in
apps/web/.env.example; API keys are never exposed through NEXT_PUBLIC variables.

Validation: preserve Gate A, add domain/state/error tests, production build,
responsive browser checks, native wallet selector and real testnet reads. Actual
wallet signature acceptance is reported separately from test doubles and SDK tests.

Stabilization: CSS tokens are implemented in globals.css. SDK 7.3.0 uses its
supported default HTTP client configuration, not an unsupported timeout field.
Workspace source exports use explicit .ts imports with allowImportingTsExtensions
and noEmit, supported by TypeScript, Next.js and tsx.

Mint rendering uses non-throwing previews; submission retains strict validation.
No-hash interruptions are labelled unconfirmed, not submitted. Recovery accepts a
wallet transaction hash for chain validation or an explicit user acknowledgement
that the wallet request is closed and no transaction was signed/submitted. There is
no automatic re-signing. Known hashes remain blocked until chain reconciliation.
Browser wallet and mint acceptance are recorded in
`docs/evidence/frontend-browser-mint.json`.

Local setup: copy apps/web/.env.example to apps/web/.env.local, npm ci, npm run dev.
Network/package values are public build-time configuration; rebuild after changes.
Discovery seeds are server-only and bounded; empty configuration produces empty states.
