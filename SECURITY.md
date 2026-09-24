# Security status

The launchpad is an early implementation and is **not audited or mainnet-ready**.
The fee policy and native Digital Asset launchpad passed 82 Move tests and real
testnet Gate A: creator launch, independent buyer mint, owner/counter/event checks
and exact 5% settlement. The browser-originated mint gate, 35 TypeScript/Node tests,
14 frontend tests, workspace typecheck and production build pass. Storage and
mainnet acceptance remain incomplete.
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

## Marketplace threat model

The V2 fee policy, shared lifecycle and isolated escrow implementation passed 73
marketplace Move tests and live Aptos testnet Gate D. It remains unaudited,
upgradeable and not mainnet-ready. V1 settlement is not implemented. See
`docs/MARKETPLACE_ARCHITECTURE.md` and `docs/MARKETPLACE_TESTNET_ACCEPTANCE.md`.

- **Fake listings and ownership claims:** entry functions derive identity and owner
  from native Move state. V1 listing must withdraw the exact `Token`; V2 listing must
  transfer the exact token object into isolated escrow. Indexer or frontend claims
  never authorize custody.
- **Replay and double settlement:** monotonic listing IDs, terminal status and an
  active-asset key make cancel/buy one-time transitions. A second transaction aborts
  before funds or custody move.
- **Stale or compromised UI price:** price is immutable. Buy includes exact
  `expected_price`; a mismatch aborts. Caller-supplied seller, fee, royalty,
  collection or recipient data is not authoritative.
- **Malicious metadata:** settlement does not fetch, parse or execute metadata.
  Names/URIs are display data and cannot influence identity, custody or payments.
- **Malicious V1 configuration:** support is limited to native maximum-1 TokenData
  and exact amount one. Royalty is read per token and validated. Actual withdrawal
  is the ownership proof; malformed/unavailable TokenData fails closed.
- **V1 delegated withdrawal:** outstanding expiring WithdrawCapability values are
  not enumerable. They cannot reach the privately stored escrow value, but may act
  after cancel or purchase returns the TokenId to their recorded owner address.
  This residual standard-level account risk must be disclosed and tested.
- **Malicious V2 configuration:** direct ownership, native Token resource, canonical
  collection relationship and ungated transfer are checked. Unknown collections are
  denied until capability provenance is reviewed because a retained creator
  TransferRef can move a token even after marketplace escrow.
- **Royalty manipulation:** exact payee/fraction is snapshotted before custody.
  Later native/V1 mutations do not change an active listing. Invalid denominator,
  fraction, payee or deductions reject listing.
- **Arithmetic and rounding:** fee/royalty multiplication uses `u128`, converts to
  `u64` only after bounds checks, floors each deduction from gross and assigns the
  complete remainder to seller. Conservation is asserted.
- **Escrow authority leakage:** V1 stores a linear `Token` value in a private table.
  V2 uses one untransferable, nondeletable escrow object and one private ExtendRef per
  listing. No token capability or generated signer is returned or exposed.
- **Admin compromise:** separate secondary fee policy is capped at 5% and rotates
  admin with two signatures. Admin can pause and change future fees/treasury, but
  cannot cancel, settle, reprice, seize, redirect royalty or revive listings.
  Publisher upgrade authority remains a separate, stronger deployment risk.
- **Denial of service through malformed assets:** adapter checks precede common
  state completion, use bounded framework fields and fail atomically. One failed
  asset cannot block unrelated listings. No generic rescue path is added.
- **Pause abuse:** global and adapter pauses stop list/buy, while authenticated seller
  cancellation remains available so pause cannot become confiscation.
- **Indexer lag:** database/indexer state is discovery and history only. Settlement
  reads Move state. Event ingestion is idempotent by network, package, version and
  event index.
- **Transaction confirmation ambiguity:** a submitted hash remains pending/unknown
  until chain reconciliation. The UI must not resubmit buy automatically; on-chain
  terminal state makes a repeated transaction harmless but gas may still be spent.

Residual risks requiring external review include package upgrades, V2 retained
creator capabilities, unusual framework-compatible token configurations, royalty
policy expectations, storage growth from terminal records/escrow shells, and gas
bounds under adversarial state. Testnet also showed that purchase-time removal of
the escrow table entry refunds storage to the buyer transaction sender even though
the seller paid listing-time storage costs. Sale-price conservation is exact, but
this network-cost allocation needs an explicit mainnet policy decision.

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
