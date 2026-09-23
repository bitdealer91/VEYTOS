# VEYTOS frontend v1

This milestone is explicitly authorised ahead of Phase 1B. Move modules, their
published names, fee rules and capability model remain unchanged.

Next.js App Router server components own page composition and initial chain reads.
React client islands own search/filter/view preferences, wallet adapter, countdowns
and transactions. Tailwind plus semantic CSS tokens supply the visual system.
TanStack Query caches live eligibility; no additional global state library.

packages/aptos contains serializable domain types, integer-safe eligibility,
transaction validation and the SDK read/payload layer. Token identity is a tagged
V1/V2 union; only real supported Digital Assets are populated today. No V1 data or
marketplace settlement is invented. Existing domain money helpers remain canonical.

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

Implemented routes: /, /explore, /drops and /collection/[id]. Activity, NFT detail,
Studio and profile routes do not exist yet and are absent from primary navigation.
Token links use Aptos Explorer. Historical holdings require Phase 1B. No buy/list actions.

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
Browser wallet and mint acceptance are pending until recorded in stabilization evidence.

Local setup: copy apps/web/.env.example to apps/web/.env.local, npm ci, npm run dev.
Network/package values are public build-time configuration; rebuild after changes.
Discovery seeds are server-only and bounded; empty configuration produces empty states.
