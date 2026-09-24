# VEYTOS marketplace architecture research

Status: design recommendation only. No marketplace Move code or trading action is
implemented in Phase 1B.

## Recommendation

Use a shared order, payment, fee, royalty and event layer with separate settlement
adapters for Token V1 and Digital Asset / Token V2. This is not abstraction for its
own sake: the standards have different on-chain asset values, identity, storage and
transfer authorization. A single transfer branch would either erase those security
differences or accumulate standard-specific logic in the payment core.

```text
marketplace core
  listing terms + APT payment + fee policy + royalty quote + events
        |                                        |
  settlement_v1                           settlement_v2
  Token value / TokenStore                Object ownership / transfer controls
```

Share immutable listing terms and economic invariants. Keep custody entry, asset
validation, delivery and return in the adapters. The core must never trust a
frontend-provided standard, owner, royalty or token identity.

## Custody and listing

Use escrow-at-listing for the first fixed-price marketplace. A non-custodial
listing that can become invalid before purchase creates avoidable stale-order and
approval races; neither standard offers one uniform persistent approval mechanism
for every historical collection.

The listing transaction must authenticate the seller, derive the canonical asset
identity, read its current owner/amount, reject unsupported restrictions, snapshot
the sale terms and move exactly one NFT into module-controlled custody atomically.
It emits one standard-neutral `ListingCreated` event containing a tagged identity.
Payment is never accepted until custody has been proven.

For V1, the seller signer withdraws the exact `TokenId` and amount into the V1
listing resource. The resource stores the actual `Token` value, not only an Indexer
hash. Property version is part of the key. On cancellation or purchase, a resource
account/object signer with an initialized `TokenStore` deposits the value to the
recipient; this avoids relying on recipient direct-transfer opt-in. Offer/claim is
unsuitable as marketplace custody because the seller remains owner until claim.

For V2, listing transfers the exact object into a marketplace escrow object/account.
The adapter must verify object type, current owner, collection relationship and
transfer controls. It must retain only the capability needed to return or deliver
that escrowed object; it must not acquire creator mutation/burn authority. A failed
transfer or unsupported custom restriction rejects listing atomically.

## Cancel and buy

Cancel authenticates the recorded seller, marks the listing consumed, and returns
the exact escrowed asset through its adapter in one transaction. There is no admin
asset withdrawal path. An emergency marketplace pause blocks new list/buy actions
but must leave seller cancellation available.

Buy authenticates the buyer, locks one active listing, verifies the expected price
and expiry, calculates royalty and platform fee with integer arithmetic, transfers
APT, delivers the escrowed asset, consumes the listing, and emits one settlement
event atomically. Any failure rolls back money, custody and state. Client slippage
arguments protect against a changed order; the contract remains authoritative.

The first implementation should accept APT only and one NFT per fixed-price
listing. It should not add offers, auctions, bundles, partial fills or alternate
fungible assets.

## Royalties and fees

Resolve royalties at purchase from the authoritative asset policy, then apply an
explicit marketplace rule documented to users. For V1 read the listed TokenData
payee/numerator/denominator. For V2 use token-level royalty when present and the
native collection fallback otherwise. Reject zero denominators and values above the
contract cap. Do not use cached Indexer data for settlement.

Because both standards record but do not universally enforce royalties, VEYTOS
must pay them inside settlement. Platform fee policy is separate and capped. Define
the price allocation precisely before implementation (royalty and platform fee
both from gross, or fee from post-royalty proceeds), enforce total deductions not
exceeding gross, and emit gross, royalty, fee and seller proceeds independently.

## Security boundaries

- The core owns economics, listing lifecycle, replay prevention, pause policy and
  events. It accepts a validated adapter result, never arbitrary payout values.
- Each adapter owns canonical identity, custody proof, transferability checks and
  exact asset delivery for one standard.
- Indexer data drives discovery only. Fullnode state and Move checks authorize
  listing and settlement.
- Listing IDs must include package/version domain separation and a monotonic nonce.
  Store an asset-to-active-listing key to prevent duplicate custody records.
- Seller, buyer and fee/royalty recipients are canonical addresses. Never accept a
  caller-provided current owner or royalty recipient without chain verification.
- Keep cancellation available during a pause. Never add arbitrary admin seizure,
  rescue, repricing or recipient replacement.
- Simulate and test custom V2 transfer restrictions and V1 TokenStore edge cases
  before mainnet. Unsupported assets fail closed with a stable reason.
- Package upgrade policy is part of custody trust. Mainnet custody code should be
  audited and immutable, or governed by a disclosed multisig and timelock design.

## V1-specific risks

- Hash IDs are Indexer conveniences; settlement must reconstruct and compare the
  full creator/collection/name/property-version identity.
- Property version zero can have amount greater than one. The adapter must withdraw
  exactly one and handle split/merge rules correctly; later fungible-like support
  should be a separate decision.
- Creator mutation and burn flags may affect the asset while listed. Pre-listing
  policy must reject unsafe configurations or disclose and test the residual risk.
- Royalty and metadata can be mutable. Read settlement-critical royalty at buy and
  cap it; do not promise metadata immutability.
- Offer/claim, direct-transfer opt-in and two-signer transfer are user transfer
  options, not interchangeable escrow primitives.

## V2-specific risks

- An Object address alone does not prove it is an NFT or belongs to the claimed
  collection. Verify the exact resources and relationships.
- Ungated transfer may be disabled; creators may retain a TransferRef or implement
  custom transfer behavior. A successful generic ownership read is not sufficient.
- Nested/object ownership and soulbound or custom resources can complicate delivery.
  The first adapter should support only direct, transferable NFT objects whose
  custody transaction succeeds under a strict allow policy.
- Token- and collection-level royalty resolution and mutable royalty capabilities
  must be handled exactly as the framework defines.

## Decision gate before implementation

Do not write settlement modules until this research is reviewed. Then produce a
Move test plan covering custody, duplicate listings, cancellation under pause,
stale price, V1 property versions/amounts, V1 recipient stores, V2 restricted and
nested objects, royalty mutation, fee caps, rollback on delivery/payment failure,
and upgrade/capability leakage. Validate both adapters against real testnet assets
before any mainnet deployment.
