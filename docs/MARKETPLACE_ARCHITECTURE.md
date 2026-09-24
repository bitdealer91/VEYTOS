# VEYTOS fixed-price marketplace specification

Status: Phase 2A specification, 2026-09-24. No marketplace Move modules exist yet.
This document is the review gate before test-first implementation.

## Framework basis

The design was rechecked against current official Aptos documentation and aptos-core
`831c39cff4c5a8ead98ddffe0edfc4ba51623e91` on the research date. Relevant sources:

- [Digital Asset standard](https://aptos.dev/build/smart-contracts/digital-asset)
  and [legacy Token standard](https://aptos.dev/build/smart-contracts/aptos-token);
- [V1 token source](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-token/sources/token.move)
  and [offer/claim source](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-token/sources/token_transfers.move);
- [V2 token source](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-token-objects/sources/token.move),
  [royalty source](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-token-objects/sources/royalty.move), and
  [Object source](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-framework/sources/object.move).

Phase 2B must compile against a deliberately pinned framework revision and rerun
this API review if the pin changes.

## Scope and invariants

Marketplace v1 supports one NFT per listing, APT payment, list, cancel and buy for
legacy Token V1 and Digital Asset / Token V2. It has no offers, bids, auctions,
bundles, partial fills, alternate payment assets or price updates.

The contract must preserve these invariants in every successful transaction:

1. An active listing has exactly one escrowed asset and one seller.
2. One asset cannot back two active listings.
3. A terminal listing cannot become active or settle again.
4. Buy is atomic: APT allocation, NFT delivery and status transition all commit or
   all roll back.
5. `gross = platform_fee + royalty + seller_proceeds` exactly.
6. Only the seller can cancel. Admin has no seize, cancel-for-user, reprice or
   recipient-substitution path.
7. Indexer and frontend data are never settlement authority.

Free transfers already exist in both standards, so marketplace price must be greater
than zero. Listing expiration is deferred: it adds time-bound recovery and indexing
states without improving the first fixed-price safety model. Repricing requires
cancel plus a new listing ID.

## Module architecture

Use four modules in a new package after this specification is approved:

- `marketplace_fee_policy.move`: independent secondary-market configuration,
  two-step admin rotation, fee recipient, global/V1/V2 pause bits, checked quote
  helpers and configuration events.
- `marketplace.move`: common listing IDs and records, status transitions, active
  asset keys, reviewed V2 collection policy, tagged asset identity, economic
  validation and canonical activity events. Only the two settlement modules are
  friends of its mutation functions.
- `settlement_v1.move`: V1 identity validation and custody table containing the
  actual `0x3::token::Token` value.
- `settlement_v2.move`: V2 token/collection validation and one isolated escrow
  object per listing.

There is no separate `listing.move`; `marketplace.move` is the lifecycle module.
This keeps common invariants in one place without forcing V1 and V2 through a
generic transfer implementation. Public entry functions live in the corresponding
settlement module and call package-scoped core functions.

Do not reuse the launchpad `fee_policy.move`. Secondary policy has a different fee,
pause domain and listing snapshot semantics. Shared source code may be factored only
if it cannot couple the two on-chain configurations.

## Fee policy and conservation

- Default marketplace fee: 200 bps (2%).
- Hard marketplace fee cap: 500 bps (5%).
- Fee recipient: nonzero configurable address.
- Admin: independent two-step transfer, intended to be a mainnet multisig.
- A listing snapshots `fee_bps`. Later fee changes affect new listings only.
- Fee-recipient rotation applies at purchase time. It changes the destination, not
  the seller's snapshotted percentage, and lets operations replace an inaccessible
  treasury without invalidating every listing.

For immutable listing price `gross`:

```text
platform_fee    = floor(gross * fee_bps / 10_000)
royalty         = floor(gross * royalty_numerator / royalty_denominator)
seller_proceeds = gross - platform_fee - royalty
```

Each multiplication uses a `u128` intermediate and is range-checked before conversion
to `u64`. Compute fee and royalty independently from gross, then assign all rounding
remainder to the seller. Require `platform_fee + royalty <= gross`; for positive
price require positive seller proceeds. Skip zero-value APT transfers. The event
records all four values and actual recipients.

## Royalty policy

Royalty terms are read from chain during listing and snapshotted with the listing.
The seller therefore signs known economics, and a creator cannot raise or redirect
royalties on an already escrowed asset. Cancellation and relisting pick up current
terms. This is VEYTOS settlement policy; neither Aptos standard enforces royalties
on every protocol-wide transfer.

For V1, construct the full `TokenId`, call `token::get_royalty`, then read payee,
numerator and denominator from the returned TokenData royalty. Read it per token
data; never use a collection sample or Indexer cache. Reject a zero denominator,
numerator greater than denominator, and a zero payee when numerator is nonzero.
An unavailable TokenData or failed read rejects listing without changing custody.

For V2, call `token::royalty(Object<Token>)`. The framework first checks royalty on
the token object and otherwise checks the canonical collection object stored in the
token. `none` means zero royalty. A present royalty was created through the native
royalty module, which validates nonzero denominator and numerator no greater than
denominator; the marketplace still asserts these conditions defensively and rejects
a nonzero royalty with zero payee.

Store the royalty payee and exact fraction, not only a rounded bps conversion. This
preserves standards that use denominators other than 10,000.

## Canonical listing record

Use a monotonic `u64` listing ID scoped to the published marketplace package. Each
record contains only common settlement state:

- listing ID;
- seller address;
- standard tag (`1` V1, `2` V2);
- canonical asset identity and collection identity;
- immutable price in octas;
- fee-bps snapshot;
- royalty payee/numerator/denominator snapshot, or zero royalty;
- creation timestamp;
- status (`ACTIVE`, `CANCELLED`, `SOLD`).

The V1 identity is creator, collection name, token name and property version. The V2
identity is token object address; its collection object address is recorded after a
native token relationship check. Indexer hashes are never accepted as V1 identity.

A package-owned active-asset map prevents a second active listing for the same
canonical identity. Terminal records remain as compact tombstones so replay attempts
fail deterministically and views can distinguish cancelled from sold. Escrow data
is removed at the terminal transition.

## V1 settlement and custody

The safest V1 escrow is direct custody of the linear `Token` value. `Token` has
`store` but not `copy` or `drop`, so it can live in a private
`Table<u64, Token>` and cannot be duplicated or silently discarded.

### List V1

1. Authenticate seller signer and construct full `TokenId` from canonical fields.
2. Require TokenData maximum `1` and seller balance exactly `1`; marketplace v1
   rejects semi-fungible editions and partial quantities.
3. Read and validate the token-specific royalty and mutability configuration.
   Mutability is disclosed/audited but does not replace the economic snapshot.
4. Reserve a listing ID and active asset key.
5. Call `token::withdraw_token(seller, token_id, 1)`.
6. Verify returned amount and identity, store the actual `Token` under the listing ID,
   complete the common record and emit `NFTListed`.

The real withdrawal is the authoritative ownership and transferability proof. There
is no recipient opt-in dependency and no offer/claim state. A creator's standard
burn/property mutation functions operate against `TokenStore`; once the value is in
the private escrow table those paths cannot withdraw that escrowed value.

V1 `WithdrawCapability` values are off-store, expiring delegations and cannot be
enumerated or revoked by the marketplace. A capability targeting the seller cannot
reach the Token while it is in the private escrow table, but may become usable again
after cancellation restores the seller's TokenStore. A capability a buyer previously
created for the same TokenId could act after purchase. This is a residual Token V1
account risk shared by ordinary transfers; VEYTOS cannot claim to eliminate it.

### Cancel V1

Authenticate the recorded seller, require active status, remove the exact `Token`
from escrow, call `token::deposit_token(seller, token)`, mark cancelled, clear the
active asset key and emit `ListingCancelled`. Cancellation remains available during
every marketplace pause.

### Buy V1

Require active status and exact expected price, calculate the snapshotted fee and
royalty, transfer APT, remove the exact escrow value, call
`token::deposit_token(buyer, token)`, mark sold, clear the active key and emit
`NFTPurchased`. The buyer signer initializes its TokenStore automatically through
`deposit_token`; direct-transfer opt-in is irrelevant.

## V2 custody decision

Marketplace v1 uses escrow at listing. A delegation model is rejected because a
normal Digital Asset owner cannot manufacture a persistent marketplace TransferRef;
only code holding creation-time capabilities can do that. Collection-specific
delegation would be nonuniform, harder to audit and unavailable to many assets.

Escrow eliminates stale seller ownership, seller transfer and approval-revocation
races. It adds one custody transaction and isolated capability storage, which is a
worthwhile cost for atomic fixed-price settlement.

### Per-listing escrow object

Create a non-deletable sticky object for each listing, generate only its `ExtendRef`, and
make the escrow object untransferable at construction. Store the `ExtendRef` in the
private V2 escrow record. Transfer the NFT from seller to the escrow object's address
with normal `object::transfer`. The listing object's generated signer can later move
only objects directly owned by that listing object. One object per listing limits a
bug's capability scope and avoids a signer that controls every listed NFT.

Do not retain the NFT's TransferRef, BurnRef, MutatorRef or ExtendRef. Do not retain
an escrow-object TransferRef or DeleteRef. Never expose the generated signer.

### List V2

1. Authenticate seller and require direct owner equality; nested ownership is not
   accepted in v1.
2. Require `0x4::token::Token`, obtain the canonical collection with
   `token::collection_object`, and require ungated transfer.
3. Resolve and validate native token-or-collection royalty.
4. Create and lock the isolated escrow object, reserve the active asset key, and
   transfer the NFT to the escrow address.
5. Assert new direct ownership, store only the escrow object's `ExtendRef`, complete
   the listing record and emit `NFTListed`.

### Cancel and buy V2

Generate the isolated escrow-object signer from its private `ExtendRef`, require the
listed token's direct owner to equal that escrow address, and use normal object
transfer to seller on cancel or buyer on purchase. Then assert the final owner,
terminally transition the listing, remove the active key and discard the escrow
record. The empty untransferable escrow shell may remain; no delete authority exists.

### Residual V2 capability risk

A creator that retained the NFT's TransferRef can generate a linear transfer ref
using the NFT's current escrow owner and move it away. There is no generic on-chain
query proving that no such capability exists. Marketplace v1 must therefore allow
V2 listings only from collections whose capability lifecycle has been reviewed or
whose contract provenance is allowlisted. VEYTOS launchpad assets qualify because
the launchpad discards NFT transfer capabilities. Unknown V2 collections fail closed
until reviewed. Escrow alone does not remove this collection-level risk.

The reviewed-collection registry is on-chain and keyed by canonical collection
object address. Admin updates emit `V2CollectionPolicyUpdated` and affect new
listings only. Removing a collection does not confiscate or silently cancel existing
escrow; the V2 pause is the incident control if purchases must also stop. Registry
approval records capability provenance review, not value or financial safety.

## Price protection and lifecycle

Price is immutable. `buy(listing_id, expected_price)` requires exact equality with
the active record. A separate `max_total` adds no protection because the buyer pays
only the immutable gross price and gas is outside Move settlement. Any reprice uses
cancel and relist, producing a new listing ID. Status is changed once; replay against
cancelled or sold records aborts before funds move.

Lifecycle:

```text
LIST: seller validation -> royalty/fee snapshot -> escrow -> ACTIVE -> NFTListed
CANCEL: ACTIVE + seller -> return asset -> CANCELLED -> ListingCancelled
BUY: ACTIVE + expected price -> APT split + asset delivery -> SOLD -> NFTPurchased
```

Every arrow is within one Aptos transaction. An abort restores the pre-transaction
state, including APT balances, escrow and listing status.

## Pause and administration

Configuration has independent global, V1 and V2 pause flags. A matching pause blocks
new listings and purchases. It never blocks seller cancellation. This lets users
recover custody during an incident and prevents pause from becoming confiscation.

Admin may update future fee bps within the cap, rotate the fee recipient, rotate
admin through two signatures, and set pause flags. Admin cannot transfer an escrowed
NFT, cancel or settle a user's listing, change listing economics, redirect royalties,
change the seller or revive a terminal listing. If a defect is specifically in a
cancel path, the response is a reviewed package mitigation; there is no hidden asset
rescue function.

## Canonical events

Use module events and a reusable nested `AssetIdentity` carrying the standard tag
and canonical fields. Fields irrelevant to one standard are fixed to zero/empty and
validated by constructors; callers cannot construct arbitrary identities.

- `NFTListed`: listing ID, asset identity, seller, gross price, fee-bps snapshot,
  royalty payee/fraction snapshot and timestamp.
- `ListingCancelled`: listing ID, asset identity, seller and timestamp.
- `NFTPurchased`: listing ID, asset identity, seller, buyer, gross price, actual
  platform-fee recipient and amount, royalty recipient and amount, seller proceeds,
  and timestamp.

Including asset identity in terminal events makes each event independently usable by
a resumable indexer. Status and amounts must agree with the on-chain listing record;
the database remains a projection.

Configuration events are separate: marketplace fee updated, fee recipient updated,
admin proposed/accepted, global/adapter pause updated, and V2 collection policy
updated.

## Mainnet OG collection pre-listing assessment

Read-only fullnode inspection of one canonical token from each collection found
maximum/supply `1/1`, empty sampled default properties, denominator `10,000`, and
all five TokenData mutability flags enabled. The checks are per token at listing;
one sample never authorizes a whole collection.

- **Aptos Monkeys — COMPATIBLE IN PRINCIPLE; REQUIRES ADDITIONAL CHECK.** Sample
  royalty 5%. Require exact identity, max/balance 1, current royalty snapshot and
  successful withdrawal. Every sampled metadata/economic field is mutable.
- **Aptomingos — COMPATIBLE IN PRINCIPLE; REQUIRES ADDITIONAL CHECK.** Sample
  royalty 8%, Arweave metadata. Same checks; distinguish the canonical creator from
  same-name collections.
- **Bruh Bears — COMPATIBLE IN PRINCIPLE; REQUIRES ADDITIONAL CHECK.** Sample
  royalty 5.5%. Largest property version is 1, so the adapter and active-asset key
  must preserve nonzero property versions.
- **Pontem Space Pirates — COMPATIBLE IN PRINCIPLE; REQUIRES ADDITIONAL CHECK.**
  Sample royalty is 0/10,000. Still read the exact token's current royalty and apply
  all identity/amount/withdrawal checks.

No mainnet transaction was sent. Compatibility means the sampled native V1 state
fits the proposed adapter, not that every token or present owner has been tested.
The public observation is preserved in
`docs/evidence/phase2a-og-token-data.json`.

## Approval gate

Before Phase 2B, review this specification and the test plan. Then implement tests
and fixtures first, followed by fee policy, common lifecycle, V1 adapter and V2
adapter in that order. No mainnet deployment occurs without testnet acceptance for
both standards, an external custody/economic audit, and an explicit upgrade policy.
