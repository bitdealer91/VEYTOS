# Security invariants

Status: internal preparation only; no independent external audit has been completed. Mainnet release remains blocked. Baseline: main `d77a27b`, 2026-09-26.

These 38 predicates are audit obligations, not claims of formal proof. “Cannot” is conditional on unchanged package code, Aptos VM atomicity and framework semantics. External V2 capabilities, framework governance and compatible upgrades are explicit exceptions to unconditional custody claims. Tests are mapped separately in [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md).

## L01

Launchpad minted count never exceeds immutable max_supply; native mint bypass is unavailable.

## L02

Cumulative mints by one signer cannot exceed wallet_limit across transactions; this is not Sybil resistance.

## L03

Primary fee snapshots and quotes are <=1000 bps; admin cannot exceed cap.

## L04

quantity*price = platform+creator; floor fee per token makes batching invariant; arithmetic cannot wrap.

## L05

Operational admin cannot seize already minted assets or expose a token capability, assuming unchanged package code.

## L06

Finalized terms and uploaded metadata cannot silently change; no setter or retained collection mutator exists.

## L07

All pause flags independently block mint; holder transfer remains possible during pause.

## M01

Only ACTIVE listings can settle; successful buy yields SOLD exactly once.

## M02

CANCELLED listings cannot be bought or cancelled again.

## M03

SOLD listings cannot be bought or cancelled again.

## M04

Price has no update path; changing price requires cancel/relist with a new ID.

## M05

The exact fee-bps snapshot is used after admin changes; treasury address is intentionally read at purchase time.

## M06

Exact royalty payee/numerator/denominator snapshot is honored despite later native mutation.

## M07

Gross = floor(gross*fee/10000)+floor(gross*n/d)+seller proceeds; seller proceeds >0.

## M08

One active asset key identifies one listing; terminal adapters remove escrow and active key atomically.

## M09

Only the nominated signer accepts admin transfer and previous admin loses authority.

## V201

Escrow ExtendRef authority is specific to its unique listing address.

## V202

Listing A authority cannot transfer listing B token.

## V203

Marketplace operation cannot move an unrelated seller/buyer NFT.

## V204

Operational admin cannot seize V2 escrow; upgrade authority is a separate assumption.

## V205

Seller can cancel while globally or V2 paused, provided underlying token transfer still works.

## V206

Successful buy gives buyer the exact stored NFT and canonical collection.

## V207

Revocation prevents new listings, preserves cancel, and intentionally does not prevent existing buy; pause is needed to stop purchases.

## V208

Safe registry approval requires external capability provenance; ungated transfer alone cannot guarantee custody.

## V101

Exact V1 creator/collection/token tuple is preserved from withdrawal through delivery.

## V102

Exact property_version is preserved; versions must never be collapsed to token-data identity. The supported settlement subset requires property_version=0 because the pinned production API does not expose authoritative TokenData defaults through `get_property_map` for nonzero versions.

## V103

One exact linear Token of amount one is privately escrowed, not a general wallet withdrawal authority.

## V104

TokenData maximum=1, property_version=0 and seller exact balance=1 are required. Before custody, the adapter reads authoritative TokenData default properties and rejects `TOKEN_BURNABLE_BY_CREATOR=true`; malformed creator-burn state, malformed royalty or missing identity aborts. Absence of the reserved property or a well-formed false value is the supported creator-burn condition under the pinned framework.

## V105

List/cancel/buy cannot withdraw unrelated V1 assets or another listing escrow.

## V106

V1 cancellation during pause remains possible without direct-transfer opt-in; admin cannot cancel for seller.

## V107

Existing WithdrawCapability cannot reach private escrow but can act when its recorded owner regains the exact TokenId.

## S01

Reimbursement is a separate snapshotted transfer, never subtracted from sale conservation; buyer must match expected snapshot.

## S02

Cancellation makes no contract reimbursement transfer and does not charge a buyer.

## S03

Terminal replay cannot pay reimbursement again or revive an escrow.

## S04

Actual validator storage refunds match measured release assumptions, independently of contract gross conservation.

## A01

A delivery/payment abort rolls back all principal, custody and listing mutations; transaction gas may still be charged.

## A02

LIST/CANCEL/BUY authorization derives from direct-chain state and signer, not frontend/database assertions.

## A03

Immutable release metadata must prohibit future package upgrades; compatible mode does not provide this property.
