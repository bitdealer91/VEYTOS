# Marketplace contract test plan

Status: Phase 2A approved. Phase 2B implements this plan test-first. V2 settlement
precedes V1 and must pass testnet Gate D before any V1 implementation begins.

## Test structure and fixtures

The marketplace package pins Aptos framework commit
`831c39cff4c5a8ead98ddffe0edfc4ba51623e91`; it must not compile against a floating
branch. If the pin changes, rerun the relevant API review.
Test-only helpers may create native V1 collections/tokens, V2 collections/tokens,
royalties, restricted objects and funded APT accounts. Production modules must not
contain fixture-only mint, signer or capability escape hatches.

Every successful test checks state, custody, balances and emitted module events.
Every expected-abort test snapshots relevant state and verifies it remains unchanged
after the failed transaction where the Move test harness permits. Use exact abort
locations and stable marketplace error codes rather than accepting any abort.

Core fixtures:

- package publisher, marketplace admin, treasury, seller, buyer, royalty payee and
  attacker accounts;
- V1 immutable 1/1, mutable-royalty 1/1, property-version token, semi-fungible token,
  zero-denominator/malformed test fixture where framework test construction permits;
- V2 token-level royalty, collection-inherited royalty, no royalty, restricted
  transfer, nested ownership and retained-TransferRef fixtures;
- maximum `u64` prices/balances and prices chosen around fee/royalty rounding edges.

## Required invariants

- Active listing count equals escrow entry count per adapter.
- Active asset key maps to exactly one active listing.
- Terminal listing has no escrow entry and no active asset key.
- V1 escrow contains the exact withdrawn `Token`; V2 token direct owner is its
  isolated escrow object.
- Fee and royalty terms in an active listing never change.
- A successful purchase conserves gross payment exactly.
- No public/admin function can obtain an escrow signer or move a different asset.

## Fee policy and economics — 18 scenarios

**F01 — initialize defaults.** Publisher initializes once; configuration reports
200 bps, nonzero recipient, all pause flags false and expected admin.

**F02 — initialization authorization.** Nonpublisher initialization aborts and no
configuration resource is created.

**F03 — reinitialization.** A second initialization attempt aborts without changing
recipient, fee, pauses or admin.

**F04 — fee update.** Admin changes fee within the 500-bps cap; event contains old
and new values and the new value applies only to later listings.

**F05 — fee cap.** Setting 501 bps aborts; quote helpers also reject an out-of-cap
fee snapshot.

**F06 — fee authorization.** Nonadmin cannot update fee.

**F07 — recipient update.** Admin rotates to a nonzero treasury and emits old/new
recipient; existing listing bps remain unchanged.

**F08 — invalid recipient.** Zero recipient is rejected at initialization and update.

**F09 — recipient authorization.** Nonadmin cannot update recipient.

**F10 — two-step admin transfer.** Proposed admin must accept; old admin remains in
control before acceptance and loses control after acceptance.

**F11 — wrong admin acceptance.** An address other than the nominee cannot accept;
zero nominee and acceptance without nomination abort.

**F12 — 2% exact quote.** Gross 100 APT yields 2 APT platform fee before royalty
and conservation holds.

**F13 — fee rounding.** Prices immediately below/above a division boundary use floor
rounding and the remainder belongs to seller proceeds.

**F14 — royalty rounding.** Non-10,000 denominator uses `floor(gross*numerator /
denominator)` with a `u128` intermediate.

**F15 — combined conservation.** Representative fee plus royalty values satisfy
gross equals fee plus royalty plus seller proceeds exactly.

**F16 — excessive deductions.** Fee plus royalty greater than gross, or zero seller
proceeds for positive price, rejects listing before custody changes.

**F17 — u64 boundary.** Maximum `u64` gross and allowed fractions quote correctly;
no intermediate overflow or truncation occurs.

**F18 — zero-price policy.** Both adapters reject price zero before royalty reads,
escrow creation or events.

## Common listing lifecycle — 22 scenarios

**G01 — create listing.** Valid adapter call assigns the next ID, records complete
immutable terms, marks active and emits one `NFTListed`.

**G02 — monotonic IDs.** IDs are unique and increase across standards and terminal
listings; an aborted listing does not leave a reachable partial record.

**G03 — asset-key uniqueness.** A canonical asset cannot have two active listings.

**G04 — cross-standard key separation.** V1 identity bytes cannot collide with a V2
object address or another V1 property version.

**G05 — cancel listing.** Seller cancellation returns asset, clears active key,
removes escrow, marks cancelled and emits one `ListingCancelled`.

**G06 — unauthorized cancel.** Buyer, attacker and admin cannot cancel a seller's
listing; custody and status stay active.

**G07 — buy listing.** Buyer receives asset, exact recipients receive APT, escrow is
removed, status is sold and one `NFTPurchased` is emitted.

**G08 — seller buys own listing.** Define and test policy: reject self-purchase to
avoid misleading volume and unnecessary royalty/fee transfers.

**G09 — nonexistent listing.** Cancel and buy unknown IDs abort before any transfer.

**G10 — cancelled replay.** Repeated cancel and buy on cancelled listing abort with
terminal status unchanged.

**G11 — sold replay.** Repeated buy and cancel on sold listing abort; buyer remains
owner and no second payment/event occurs.

**G12 — wrong expected price.** Buy with lower or higher expected price aborts before
funds move.

**G13 — immutable price.** No entry function changes price; cancel/relist creates a
new ID with new terms.

**G14 — fee snapshot.** Admin fee change after listing does not change that listing's
fee calculation; a later listing receives the new bps.

**G15 — recipient rotation.** Treasury rotation after listing sends the unchanged
snapshotted fee amount to the current recipient and records it in purchase event.

**G16 — royalty snapshot.** Underlying mutable royalty changes after listing do not
change payee, fraction or seller proceeds for that listing.

**G17 — global pause.** Global pause blocks both adapters' list and buy paths.

**G18 — V1 adapter pause.** Blocks V1 list/buy but permits V2 list/buy.

**G19 — V2 adapter pause.** Blocks V2 list/buy but permits V1 list/buy.

**G20 — cancellation during pause.** Seller can cancel V1 and V2 listings during
global and adapter pauses.

**G21 — pause authorization.** Only admin can change pause bits; events identify
scope and new state.

**G22 — event consistency.** Listed/cancelled/purchased events contain the canonical
identity, listing ID, participants, amounts and timestamp matching stored state.

## Token V1 adapter — 20 scenarios

**V101 — successful escrow.** Seller's 1/1 TokenStore balance becomes zero, the exact
`Token` is in private escrow and listing is active.

**V102 — successful cancel.** Escrow entry is removed and seller's TokenStore balance
returns to one even when direct-transfer opt-in is false.

**V103 — successful buy.** Buyer TokenStore is initialized if absent and receives the
exact identity/property version; seller no longer owns it.

**V104 — unowned token.** Listing an identity with seller balance zero aborts without
reserving a listing or touching unrelated tokens.

**V105 — wrong identity.** Wrong creator, collection, token name or property version
cannot withdraw or alias the real asset.

**V106 — property-version identity.** Property versions zero and nonzero receive
distinct keys; a nonzero version survives escrow, cancel and buy unchanged.

**V107 — semi-fungible rejection.** TokenData maximum other than one or seller
balance other than exactly one is rejected before withdrawal.

**V108 — exact amount.** Returned escrow token amount must equal one; no split,
partial listing or merge path is exposed.

**V109 — royalty read.** Listing reads payee/numerator/denominator from the exact
TokenData, snapshots them and pays the snapshot on purchase.

**V110 — malformed royalty.** Zero denominator, numerator over denominator, missing
TokenData or nonzero royalty with zero payee rejects listing without custody.

**V111 — mutable royalty.** Creator changes royalty after listing; purchase still
uses the signed snapshot, while cancel/relist reads the new royalty.

**V112 — creator royalty payment.** Purchase sends exact rounded amount to royalty
payee and event reports the same values.

**V113 — seller TokenStore opt-in.** Cancel succeeds regardless of seller's direct
transfer flag because `deposit_token` uses the authenticated seller signer.

**V114 — buyer TokenStore opt-in.** Buy succeeds for a buyer with no TokenStore or
with opt-in false; no offer/claim record is created.

**V115 — creator burn/property path.** Standard creator mutation/burn attempts cannot
withdraw the `Token` stored in the marketplace's private table.

**V116 — admin cannot steal escrow.** Fee/pause/admin operations cannot borrow,
remove or deposit the escrowed Token; no public signer/capability path exists.

**V117 — seller cannot transfer escrow elsewhere.** After listing, seller TokenStore
balance is zero and normal transfer/offer calls fail without changing listing.

**V118 — unrelated assets untouched.** Listing, cancel and buy change only the exact
TokenId; all other seller/buyer TokenStore balances and pending claims remain equal.

**V119 — preexisting seller WithdrawCapability.** An unexpired capability cannot
reach the Token while it is in marketplace escrow; after seller cancellation it can
act on the restored TokenStore balance. Document this residual owner-delegation risk.

**V120 — preexisting buyer WithdrawCapability.** A capability previously created by
the buyer for the same TokenId can act after purchase. Settlement remains atomic and
correct, but the test proves the marketplace cannot enumerate or revoke V1 delegated
capabilities.

## Digital Asset / Token V2 adapter — 20 scenarios

**V201 — successful listing.** Directly owned transferable token moves to a unique
untransferable listing escrow object and listing becomes active.

**V202 — successful cancel.** Escrow signer returns exact token to seller, escrow
record is removed and the empty escrow shell cannot be transferred.

**V203 — successful buy.** Exact token moves from isolated escrow to buyer, ownership
assertion passes and listing becomes sold.

**V204 — unowned object.** A signer that is not direct owner cannot list the token.

**V205 — nested ownership.** Indirect ownership through another object is rejected
in marketplace v1 even if framework traversal would otherwise allow transfer.

**V206 — wrong resource type.** Plain Object or non-token object address cannot be
listed as a Digital Asset.

**V207 — collection identity.** Recorded collection comes from
`token::collection_object`; caller cannot substitute another address.

**V208 — ungated transfer disabled.** Restricted/untransferable token fails listing
atomically before an active record or usable escrow capability remains.

**V209 — token-level royalty.** Native royalty on token overrides collection royalty
and exact terms are snapshotted.

**V210 — inherited royalty.** No token royalty falls back to canonical collection
royalty and pays its payee.

**V211 — no royalty.** No token or collection royalty produces zero royalty and full
remaining proceeds after platform fee.

**V212 — mutable royalty.** Retained native royalty mutator changes chain policy
after listing; existing sale honors snapshot and relist reads the new value.

**V213 — isolated capability scope.** Listing A's ExtendRef-generated signer cannot
move token B from listing B or any seller-owned token.

**V214 — no NFT capabilities retained.** Marketplace state contains no token
TransferRef, BurnRef, MutatorRef or ExtendRef and exposes no generated signer.

**V215 — seller cannot move escrowed NFT.** Normal seller transfer after listing
fails and token remains directly owned by escrow object.

**V216 — admin cannot move escrow.** Admin signer and configuration paths cannot
transfer token or escrow shell.

**V217 — reviewed collection registry.** Admin can add/remove a canonical collection,
the event records the decision, and nonadmin/zero/non-collection updates fail.

**V218 — unreviewed collection rejected.** A valid transferable token from an
unreviewed collection cannot be listed and leaves no escrow or active record.

**V219 — retained creator TransferRef threat fixture.** Demonstrate that an external
retained TransferRef can move an escrowed token if such a collection were approved.
This test documents why registry review is a security boundary.

**V220 — unrelated assets untouched.** Listing/cancel/buy for one object leaves all
other seller, buyer and escrow-object ownership unchanged.

## Atomicity, failure and adversarial behavior — 14 scenarios

**A01 — insufficient buyer APT.** Purchase aborts; buyer principal, seller, treasury
and royalty balances are unchanged in Move state, NFT remains escrowed and active.

**A02 — fee transfer failure.** Forced invalid recipient/config fixture aborts entire
purchase with no partial seller/royalty payment or delivery.

**A03 — royalty transfer failure.** Forced invalid royalty fixture aborts before or
during settlement and rolls back every balance and custody change.

**A04 — asset delivery failure.** Adapter delivery abort after payment instructions
rolls back all APT transfers, ownership and listing transition.

**A05 — status transition failure.** Forced terminal-state conflict rolls back
payments and asset movement rather than leaving an untracked escrow.

**A06 — escrow missing/corrupt.** Active record without matching test escrow aborts
buy/cancel and sends no funds; invariant checker detects the fixture corruption.

**A07 — duplicate settlement race.** Two serialized buyers target one ID; first
success commits and second sees sold without paying.

**A08 — compromised frontend arguments.** Forged seller, collection, royalty,
standard tag or recipients are ignored/rejected because chain state derives them.

**A09 — malicious metadata.** Empty, oversized or hostile URI content has no effect
on identity, custody or settlement because marketplace never fetches metadata.

**A10 — large identity inputs.** Framework-bounded V1 strings and adversarial values
fail predictably without unbounded loops or unrelated state changes.

**A11 — indexer lag.** Settlement succeeds/fails from Move state independent of a
stale off-chain owner/listing projection; replay remains blocked on-chain.

**A12 — transaction ambiguity.** A committed purchase event/status is idempotently
reconcilable by `(network, package, listing_id, transaction_version, event_index)`;
client retry cannot produce a second sale.

**A13 — pause recovery matrix.** For every global/V1/V2 pause combination, list/buy
follow policy and seller cancellation remains available for both standards.

**A14 — package authority boundary.** No operational admin path exposes publisher,
escrow or object signers. Tests document that package upgrade authority remains a
separate deployment trust assumption, not an in-module admin feature.

## Phase 2B execution order

1. Add F01–F18 and implement the independent fee policy.
2. Add G01–G22 and implement common lifecycle and events.
3. Add V201–V220 plus early adversarial cases and implement isolated V2 escrow.
4. Publish V2 to testnet and pass marketplace Gate D with independent roles.
5. Only then add V101–V120 and implement V1 direct-Token escrow.
6. Execute representative V1 acceptance, then complete A01–A14 and cross-adapter
   regression runs.

Do not weaken a scenario to fit an implementation. Any architectural change found
while tests are red must update this specification and receive review before code is
treated as marketplace-ready.
