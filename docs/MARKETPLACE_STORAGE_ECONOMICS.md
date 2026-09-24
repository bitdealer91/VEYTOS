# Marketplace storage economics

Status: implemented for the hardened V2 package; testnet re-acceptance is required before V1.

Framework source: Aptos framework revision `831c39cff4c5a8ead98ddffe0edfc4ba51623e91`.

## Gate D observation

The original V2 BUY transaction `0x883a1bb6b2a51560d350ab999a8766220896abfd3e79b886249ca0dd6f0f436f`
reported a `926,400` octa storage deletion refund. Its successful write set deleted exactly two
table items:

- `settlement_v2::Escrows.entries[listing_id]`: `467,200` octas;
- `marketplace::State.active_assets[asset_identity]`: `459,200` octas.

The same two deletions occurred during CANCEL and produced the same `926,400` octa refund.
LIST created those slots and the seller paid their deposits. CANCEL was submitted by the seller,
so the seller received the refund. BUY was submitted by the buyer, so the buyer received it.

The amounts follow the pinned framework's refundable-byte pricing: a new slot deposits `400,000`
octas plus `400` octas for every state-key and value byte. The escrow entry uses a 40-byte state
key and 128-byte value: `400,000 + (40 + 128) * 400 = 467,200`. The active-asset entry uses a
140-byte state key and 8-byte value: `400,000 + (140 + 8) * 400 = 459,200`.

Deletion refunds are deterministic for a particular slot because Aptos records the paid slot and
byte deposits in the slot's state metadata. A later gas-schedule change does not retroactively
change that recorded deposit. The successful transaction epilogue credits the deletion refund to
the transaction gas payer. Failed transactions do not delete slots and receive no deletion refund.

Primary sources:

- [Pinned disk-space pricing implementation](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/aptos-vm-types/src/storage/space_pricing.rs)
- [Pinned fee statement and refund implementation](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-framework/sources/transaction_fee.move)
- [Pinned transaction epilogue](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-framework/sources/transaction_validation.move)
- [Pinned table removal API](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-stdlib/sources/table.move)

## Policy considered

### Leave the refund with the transaction sender

This is the smallest implementation but gives a buyer a seller-funded benefit. Even if disclosed,
the buyer's net debit becomes smaller than the reviewed sale price plus transaction cost. Rejected.

### Retain active and escrow table slots

This avoids the refund but preserves capabilities and state after settlement. The active-asset key
also has to become reusable for relisting. It increases permanent state and makes terminal custody
harder to audit. Rejected.

### Refundable listing deposit held by VEYTOS

An additional seller deposit does not repay the seller's protocol storage charge; returning it only
returns the seller's own extra funds. It also makes VEYTOS a fund custodian. Rejected.

### Buyer-funded storage reimbursement

Each listing snapshots a configured reimbursement. BUY price-protects that value and transfers it
to the seller in addition to sale proceeds. The transaction gas payer receives the corresponding
protocol deletion refund. CANCEL makes no contract reimbursement because the seller directly
receives the protocol refund. This restores the intended allocation without holding deposits.

Selected policy: **buyer-funded, seller-paid storage reimbursement**.

The initial V2 reimbursement is `926,400` octas. It is independently configurable by the two-step
marketplace admin, capped at `10,000,000` octas, emitted when changed, and snapshotted per listing.
Operators must compare simulation and committed `FeeStatement` evidence before changing it. A
buyer supplies the expected snapshot when buying, so a stale UI cannot silently accept a different
total. Sale-price accounting remains separate:

`gross price = platform fee + royalty + seller sale proceeds`

The storage reimbursement is a separate network-cost transfer and is emitted separately in listing
and purchase events.

## Escrow object shell

The original package used `object::create_sticky_object`, leaving an `ObjectCore` and
`Untransferable` resource group after the NFT left escrow. That group had a `513,600` octa deposit.
Because a sticky object cannot generate a `DeleteRef`, it could not be removed.

The hardened package uses `object::create_unique_onchain_signer`. Aptos documents this as the
lightweight equivalent of creating a deletable object, generating an `ExtendRef`, and immediately
deleting its `ObjectCore`. The unique signer address has no object resources. The isolated
`ExtendRef` still controls only the unique escrow address, and the exact NFT must be owned by that
address before transfer. No terminal shell remains and no additional deletion refund is created.

The on-chain listing remains as the terminal tombstone. With the reimbursement snapshot added, its
deposit is `507,200` octas per listing. Keeping it provides authoritative `CANCELLED`/`SOLD` status,
immutable terms, and direct replay evidence. Replacing it with a smaller tombstone saves little
because every state slot has a `400,000` octa base deposit and would add migration complexity.

Expected terminal listing state growth at the current schedule:

- 1,000 listings: `5.072 APT` deposited;
- 100,000 listings: `507.2 APT` deposited;
- 1,000,000 listings: `5,072 APT` deposited.

These figures are locked storage deposits rather than recurring rent. Events and an off-chain
indexer preserve activity history, but the terminal listing remains on chain for security and
auditable terms. This policy should be revisited only if Aptos adds an authenticated compact-state
or designated-refund mechanism, or observed scale makes the slot deposit material.

## Unit-test limitation

Move unit tests verify the reimbursement snapshot, authorization, cap, expected-value protection,
atomic settlement, terminal status, and absence of an escrow object shell. They do not execute the
validator storage-fee accounting and cannot prove `FeeStatement` amounts. LIST/CANCEL/RELIST/BUY
must therefore be repeated on testnet after any change to state layout or storage policy.
