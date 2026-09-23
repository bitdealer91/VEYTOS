# Security status

This is an early Phase 1 implementation. It is **not audited or mainnet-ready**.
The fee policy and native Digital Asset launchpad passed 82 Move tests and real
testnet Gate A: creator launch, independent buyer mint, owner/counter/event checks
and exact 5% settlement. Thirteen TypeScript tests and script type checking pass.
This is SDK/operator acceptance, not browser wallet, storage or mainnet acceptance.
See [TESTNET_ACCEPTANCE.md](TESTNET_ACCEPTANCE.md) for exact transactions and limits.

## Trust boundaries

- Chain state owns mint rules, payments, royalty configuration and asset ownership.
- Database entries are projections and moderation records, not ownership evidence.
- Wallet connection is not authentication. Future authenticated routes must use
  validated, one-use, domain/network-bound SIWA challenges and server-side sessions.
- IPFS addressing proves content identity, not availability, safety or copyright.
- Creator verification is provenance review, not a financial or safety guarantee.
- UI hiding does not delete, freeze or censor the underlying blockchain asset.

## Authority and custody

The fee-policy resource can be initialized only by the publishing address.
Initialization chooses the treasury; production addresses are never hardcoded.
The initial fee is 500 bps (5%). Fee changes
are bounded at 10%. Recipient changes and pause need the configured admin signer.
Admin rotation requires the proposed successor's signature. A lost admin cannot be
recovered by an undocumented backdoor. Mainnet requires a secured multisig process.

Fee policy holds no funds and cannot seize NFTs. Launchpad snapshots the fee when
preparing a drop, requires the creator to confirm it at finalization, and settles
atomically to the creator and current configured treasury. Administrative fee
changes affect future drops; treasury rotation changes destination, not the split.

The only retained authority capability is an `ExtendRef` inside the private Drop
resource. The authority object is transferred to `0x0` and ungated transfer is
disabled. It creates the native collection/tokens through checked launchpad entry
points. No public function exposes its signer or capability. Native collections
are locked against transfer; NFTs retain normal holder transferability. No NFT
ExtendRef, TransferRef, BurnRef, MutatorRef or royalty mutation capability is stored.
Constructor references are transaction-local and discarded. Unit tests cover native
creator/owner mint bypass and admin seizure attempts; these are not an external audit.

The current Move package uses compatible upgrades for testnet development. A package
upgrade can change security behavior: operational admin restrictions do not constrain
the publisher's upgrade authority. Switch to a reviewed immutable package for mainnet
and verify published metadata. Do not describe this development package as immutable.

## Required review areas before launch

- Capability leakage: creator and native collection owner mint paths; retained
  ExtendRef/TransferRef/MutatorRef/BurnRef; direct mint/transfer bypass attempts.
- u64 boundaries, u128 intermediate products, per-token rounding, free-mint path,
  supply and wallet counters, chain-time boundaries and transaction rollback.
- Atomic indexing and checkpoint recovery; forged hashes, duplicate events,
  wrong networks/modules and stale indexer responses.
- SIWA all supported account schemes; challenge replay, CSRF, nonce races, session
  theft, role escalation, and authorization on every draft/upload/moderation route.
- Upload quota, content types, IPFS URI checks, content/manifest consistency,
  SSRF, untrusted redirects and rendered HTML/SVG/script content.
- Wallet error translation, unknown transaction status, double submits, payload
  comparison with the reviewed terms, fee snapshots and chain switching.
- Dependency audit, lockfile reproducibility, secret scan, external contract review,
  on-chain admin/treasury validation and incident response rehearsal.

## Secrets and reporting

Never commit private keys, wallet recovery phrases, database URLs, API credentials,
session tokens or `.aptos` profiles. `.env.example` has no credentials. CLI profiles
must be stored outside the repository. Gate A requires disposable keys in an
external owner-only file, resolved through `MINTOS_TESTNET_ACCOUNTS_FILE`; it rejects
paths or symlinks resolving inside the repository. No key material belongs in `.env`.
The ignored transaction journal contains signed transactions, not keys. Treat it
as operator data: a pending signed transaction can be broadcast until expiration.
Do not publish real signing keys in vulnerability reports. Until a dedicated private
security contact exists, use a private channel to the repository owner; public issues
are unsuitable for exploitable details.

## Incident controls

Platform pause stops drop preparation/finalization/minting. Creator and admin drop
pauses independently stop mints; neither clears the other's flag. Existing NFTs
remain transferable. Future moderators can hide malicious collections separately. Maintain an
audited trail of pause, configuration and moderation decisions. Treasury rotation
does not recover funds already delivered to the previous treasury.

## Gate A limitations and operational recovery

Testnet treasury and publisher share one disposable address; creator and buyer are
distinct. This does not satisfy mainnet multisig or treasury operations requirements.
Publication was verified byte-for-byte against local production module artifacts.
The pinned framework APIs worked on testnet; mainnet must be checked independently.

Metadata has immutable content-addressed URIs, but fixtures are local and unpinned.
The on-chain URI parser validates bounded ASCII shape only. Full CID/content safety,
availability, retention and SSRF protection remain application/storage work.

A 25-entry metadata upload hit the original 200,000 gas limit. The committed abort
was verified to leave upload/mint counters unchanged, archived, then deliberately
retried with 500,000 gas and additional creator funding. Future success transactions
are simulated before signing; full 10,000-supply/20-mint limit benchmarks remain open.

The operator tool journals signed bytes before submission and reconciles by hash.
It stops on ambiguous RPC responses and never silently replaces unknown transactions.
A recorded committed failure requires explicit reconciliation before creating a new
attempt; an expired/unknown transaction must not be assumed failed. A stale run lock
may only be removed after checking its process is gone and reconciling pending hashes.
