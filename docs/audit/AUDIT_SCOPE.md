# Audit scope

Status: internal preparation only; no independent external audit has been completed. Mainnet release remains blocked. Baseline: main `d77a27b`, 2026-09-26.

## Boundary and review order

Review all six production modules below as one custody/economics boundary. Package-visible helpers are security-critical even though users cannot call them directly. Review test-only helpers separately for exclusion from published bytecode. No production Move source, manifest, custody behavior, or deployment is changed by Phase 3C.

Launchpad: `move/launchpad`, package `MintosLaunchpad`, named address `launchpad`, development address `0xcafe`; framework pin `1b116b414ccc1d860fa72160d9b9a770e8d8e88f`.
Marketplace: `move/marketplace`, package `VeytosMarketplace`, named address `marketplace`, development address `0xbeef`; framework pin `831c39cff4c5a8ead98ddffe0edfc4ba51623e91`.
Both manifests currently specify `compatible`. Pins differ intentionally in this baseline; do not silently harmonize them. Framework/VM semantics are dependencies, not independently verified by this package's tests.

Prioritize capability reachability, exact identity, atomic payment/delivery, upgrade authority, V2 external capabilities, then arithmetic, pause/recovery and storage policy. Supporting review covers `packages/aptos`, `packages/domain`, indexer scripts, database projection, frontend payload construction and acceptance journals. Storage, authentication, provider availability and content safety need separate application/operational review; they are not proven by a Move audit.

## `launchpad::fee_policy`

Source: [`move/launchpad/sources/fee_policy.move`](../../move/launchpad/sources/fee_policy.move).

Purpose: Primary fee configuration and per-token rounded quotes.

Stored resources/capabilities: Config at @launchpad: admin, pending_admin, fee_bps, recipient, paused. No signer/custody capability.

Authorities and moving assets: Configured admin changes capped fees, recipient and pause; nominates successor who must accept. Publisher only initializes once. No funds or NFTs move here.

Important abort conditions: Fee cap 1000 bps, nonzero recipient/nominee, authorized caller, initialized-once state, positive quantity, total <= u64. quote is public and stateless; mint supplies the stored rate.

Public entry functions (complete inventory):

- `initialize(publisher: &signer, recipient: address)`
- `set_fee(caller: &signer, new_bps: u64)`
- `set_recipient(caller: &signer, new_recipient: address)`
- `set_paused(caller: &signer, paused: bool)`
- `propose_admin(caller: &signer, proposed_admin: address)`
- `accept_admin(caller: &signer)`

Package-visible helpers: none. Views/read-only public helpers are also in scope; see source for return structures.

Events: `PlatformInitialized`, `PlatformFeeUpdated`, `FeeRecipientUpdated`, `PlatformPauseUpdated`, `AdminTransferProposed`, `AdminTransferAccepted`.

Abort inventory (module-local codes; framework aborts propagate): `EUNAUTHORIZED=1`, `EFEE_TOO_HIGH=2`, `EZERO_ADDRESS=3`, `EZERO_QUANTITY=4`, `EAMOUNT_OVERFLOW=5`, `ENOT_PENDING_ADMIN=6`, `ENOT_INITIALIZED=7`, `EALREADY_INITIALIZED=8`.

Direct Aptos dependencies: `aptos_framework::event`. Standard library and same-package dependencies are visible in source imports.

## `launchpad::launchpad`

Source: [`move/launchpad/sources/launchpad.move`](../../move/launchpad/sources/launchpad.move).

Purpose: Prepare/finalize fixed-supply native collections and atomically mint for APT.

Stored resources/capabilities: Drop at deterministic creator/seed address stores immutable Terms, metadata/name/URI tables, wallet counters, counters and pause flags; its private ExtendRef generates only the drop signer. Drop ownership is moved to 0x0 and ungated transfer disabled. Collection/token constructor refs expire; no NFT transfer/burn/mutator authority is retained.

Authorities and moving assets: Creator appends/finalizes and controls creator pause; fee-policy admin controls independent admin pause. Buyers pay APT to creator and current treasury; newly constructed exact tokens go to buyer. No admin sweep/withdraw/mint-for-free function.

Important abort conditions: Supply 1..10000, mint quantity <=20 and configured limits, chunks <=25, valid schedule and bounded URI shape, complete unique metadata, finalization/price/fee review, lifetime wallet/supply counters, sufficient gross APT, independent pauses. Terms have no update entry.

Public entry functions (complete inventory):

- `prepare_drop(creator: &signer, id: vector<u8>, name: String, description: String, collection_uri: String, max_supply: u64, unit_price: u64, wallet_limit: u64, transaction_limit: u64, start_seconds: u64, end_seconds: u64, royalty_bps: u64, expected_fee_bps: u64)`
- `append_metadata(creator: &signer, drop: address, offset: u64, names: vector<String>, uris: vector<String>)`
- `finalize_drop(creator: &signer, drop: address, expected_fee_bps: u64)`
- `mint(buyer: &signer, drop: address, quantity: u64, expected_unit_price: u64, max_total: u64)`
- `set_creator_paused(creator: &signer, drop: address, paused: bool)`
- `set_admin_paused(caller: &signer, drop: address, paused: bool)`

Package-visible helpers: none. Views/read-only public helpers are also in scope; see source for return structures.

Events: `DropPrepared`, `MetadataAppended`, `CollectionCreated`, `NFTMinted`, `CollectionPauseUpdated`.

Abort inventory (module-local codes; framework aborts propagate): `EUNAUTHORIZED=1`, `EINVALID_TERMS=2`, `EFINALIZED=3`, `EMETADATA_COUNT=4`, `EDUPLICATE_METADATA=5`, `EINCOMPLETE=6`, `ENOT_FINALIZED=7`, `EPAUSED=8`, `ENOT_STARTED=9`, `EENDED=10`, `EQUANTITY=11`, `EWALLET_LIMIT=12`, `ESUPPLY=13`, `EPRICE_CHANGED=14`, `EMAX_TOTAL=15`, `EFEE_REVIEW=16`, `EINVALID_METADATA=17`, `EDROP_NOT_FOUND=18`, `EINSUFFICIENT_APT=19`.

Direct Aptos dependencies: `aptos_std::table::{Self, Table}`, `aptos_framework::object::{Self, ExtendRef}`, `aptos_framework::timestamp`, `aptos_framework::event`, `aptos_framework::aptos_account`, `aptos_framework::aptos_coin::AptosCoin`, `aptos_framework::coin`, `aptos_token_objects::collection`, `aptos_token_objects::token`, `aptos_token_objects::royalty`. Standard library and same-package dependencies are visible in source imports.

## `marketplace::marketplace`

Source: [`move/marketplace/sources/marketplace.move`](../../move/marketplace/sources/marketplace.move).

Purpose: Shared immutable listing terms, canonical identity, registry and one-way lifecycle; APT payment.

Stored resources/capabilities: State at @marketplace: next_listing_id, listings Table<u64, Listing>, active_assets keyed by BCS AssetIdentity, v2_collections policies. Listing tombstones remain. No signer/custody capability.

Authorities and moving assets: Marketplace fee-policy admin alone edits collection review/provenance. Package modules alone construct identity/create/cancel/buy listings. Authenticated adapter seller cancels; buyer pays current treasury, snapshotted royalty payee and seller. Price/fee/royalty/reimbursement snapshots cannot be repriced.

Important abort conditions: ACTIVE required, seller cancel authorization, exact expected price and reimbursement, no self-buy, unique active asset, standard/identity matches, valid royalties, reviewed V2 at list only, listing ID < u64 max, seller proceeds+reimbursement <= u64. Buy does not recheck registry; revoke is not a purchase pause.

Public entry functions (complete inventory):

- `initialize(publisher: &signer)`
- `set_v2_collection_reviewed(caller: &signer, collection_address: address, provenance: u8, reviewed: bool)`

Package-visible helpers: `assert_v2_collection_reviewed`, `new_v1_identity`, `new_v2_identity`, `assert_v2_identity`, `assert_v1_identity`, `create_listing`, `cancel_listing`, `buy_listing`. Views/read-only public helpers are also in scope; see source for return structures.

Events: `NFTListed`, `ListingCancelled`, `NFTPurchased`, `V2CollectionPolicyUpdated`.

Abort inventory (module-local codes; framework aborts propagate): `ENOT_INITIALIZED=1`, `EUNAUTHORIZED=2`, `ELISTING_NOT_FOUND=3`, `ELISTING_NOT_ACTIVE=4`, `EPRICE_CHANGED=5`, `EASSET_ALREADY_LISTED=6`, `ESTANDARD_MISMATCH=7`, `ESELF_PURCHASE=8`, `EINVALID_ROYALTY=9`, `ECOLLECTION_NOT_REVIEWED=10`, `EINVALID_PROVENANCE=11`, `EINVALID_COLLECTION=12`, `EALREADY_INITIALIZED=13`, `ELISTING_ID_OVERFLOW=14`, `ESTORAGE_REIMBURSEMENT_CHANGED=15`, `ETOTAL_OVERFLOW=16`.

Direct Aptos dependencies: `aptos_std::table::{Self, Table}`, `aptos_framework::aptos_account`, `aptos_framework::event`, `aptos_framework::object`, `aptos_framework::timestamp`, `aptos_token_objects::collection::{Self, Collection}`. Standard library and same-package dependencies are visible in source imports.

## `marketplace::marketplace_fee_policy`

Source: [`move/marketplace/sources/marketplace_fee_policy.move`](../../move/marketplace/sources/marketplace_fee_policy.move).

Purpose: Independent secondary fee, reimbursement, pause and administration.

Stored resources/capabilities: Config at @marketplace stores admin, pending_admin, recipient, fee, per-standard reimbursement and global/V1/V2 pause flags. No NFT or signer capability.

Authorities and moving assets: One configured marketplace admin controls all these settings. Publisher initializes once. No asset transfer in this module; quote_sale determines deductions.

Important abort conditions: Initial fee 200 bps, cap 500; positive gross; denominator >0 and numerator <= denominator; fee+royalty strictly less than gross. V1 reimbursement default 0, V2 926400 octas, each capped at 10000000. Admin and nonzero destination checks.

Public entry functions (complete inventory):

- `initialize(publisher: &signer, recipient: address)`
- `set_fee(caller: &signer, new_bps: u64)`
- `set_recipient(caller: &signer, new_recipient: address)`
- `set_v1_storage_reimbursement(caller: &signer, new_octas: u64)`
- `set_v2_storage_reimbursement(caller: &signer, new_octas: u64)`
- `set_global_paused(caller: &signer, paused: bool)`
- `set_v1_paused(caller: &signer, paused: bool)`
- `set_v2_paused(caller: &signer, paused: bool)`
- `propose_admin(caller: &signer, proposed_admin: address)`
- `accept_admin(caller: &signer)`

Package-visible helpers: `assert_v1_open`, `assert_v2_open`. Views/read-only public helpers are also in scope; see source for return structures.

Events: `MarketplaceInitialized`, `MarketplaceFeeUpdated`, `MarketplaceFeeRecipientUpdated`, `MarketplaceStorageReimbursementUpdated`, `MarketplacePauseUpdated`, `MarketplaceAdminTransferProposed`, `MarketplaceAdminTransferAccepted`.

Abort inventory (module-local codes; framework aborts propagate): `EUNAUTHORIZED=1`, `EFEE_TOO_HIGH=2`, `EZERO_ADDRESS=3`, `EINVALID_ROYALTY=4`, `ENOT_INITIALIZED=5`, `ENOT_PENDING_ADMIN=6`, `EZERO_NOMINEE=7`, `EALREADY_INITIALIZED=8`, `EZERO_PRICE=9`, `EINVALID_DEDUCTIONS=10`, `EPAUSED=11`, `ESTORAGE_REIMBURSEMENT_TOO_HIGH=12`.

Direct Aptos dependencies: `aptos_framework::event`. Standard library and same-package dependencies are visible in source imports.

## `marketplace::settlement_v1`

Source: [`move/marketplace/sources/settlement_v1.move`](../../move/marketplace/sources/settlement_v1.move).

Purpose: Escrow and deliver the exact native Token V1 linear value.

Stored resources/capabilities: Escrows at @marketplace holds Table<u64, 0x3::token::Token>. TokenId includes creator, collection name, token name, property_version. No resource-account signer, WithdrawCapability or arbitrary withdrawal power retained.

Authorities and moving assets: Publisher initializes once. Seller must sign actual withdraw; cancel deposits to authenticated seller, buy deposits to authenticated buyer. Admin has no escrow removal path. Shared module settles APT.

Important abort conditions: TokenData maximum exactly 1, seller exact TokenId balance exactly 1, valid royalty fraction/payee, withdrawn amount exactly 1, full tuple identity equality. Missing/wrong escrow or terminal replay aborts. Framework missing TokenData/TokenStore and withdrawal restrictions may also abort.

Public entry functions (complete inventory):

- `initialize(publisher: &signer)`
- `list(seller: &signer, creator: address, collection_name: String, token_name: String, property_version: u64, price: u64)`
- `cancel(seller: &signer, listing_id: u64)`
- `buy(buyer: &signer, listing_id: u64, expected_price: u64, expected_storage_reimbursement: u64)`

Package-visible helpers: none. Views/read-only public helpers are also in scope; see source for return structures.

Events: none locally; lifecycle/payment events are emitted by marketplace.

Abort inventory (module-local codes; framework aborts propagate): `EUNAUTHORIZED=1`, `EALREADY_INITIALIZED=2`, `ENOT_INITIALIZED=3`, `ENOT_UNIQUE_NFT=4`, `ENOT_EXACT_OWNER=5`, `EINVALID_ROYALTY=6`, `EESCROW_NOT_FOUND=7`, `EESCROW_MISMATCH=8`.

Direct Aptos dependencies: `aptos_std::table::{Self, Table}`, `aptos_token::token::{Self, Token, TokenId}`. Standard library and same-package dependencies are visible in source imports.

## `marketplace::settlement_v2`

Source: [`move/marketplace/sources/settlement_v2.move`](../../move/marketplace/sources/settlement_v2.move).

Purpose: Escrow one exact native Digital Asset at a unique signer address per listing.

Stored resources/capabilities: Escrows at @marketplace holds Table<u64, Escrow>; each Escrow retains only its unique address ExtendRef plus exact token/collection/address. create_unique_onchain_signer leaves no ObjectCore escrow shell. No NFT TransferRef/BurnRef/MutatorRef/ExtendRef is retained.

Authorities and moving assets: Publisher initializes once; direct seller signs list; authenticated seller cancels; buyer receives exact token on buy. Admin cannot generate escrow signer through a public API. Shared module settles APT.

Important abort conditions: Native Token exists, direct ownership, ungated transfer, canonical reviewed collection, valid effective royalty; verify owner after escrow, exact identity and current escrow owner before delivery, and recipient owner after delivery. External retained creator capabilities remain a registry trust risk.

Public entry functions (complete inventory):

- `initialize(publisher: &signer)`
- `list(seller: &signer, token_address: address, price: u64)`
- `cancel(seller: &signer, listing_id: u64)`
- `buy(buyer: &signer, listing_id: u64, expected_price: u64, expected_storage_reimbursement: u64)`

Package-visible helpers: none. Views/read-only public helpers are also in scope; see source for return structures.

Events: none locally; lifecycle/payment events are emitted by marketplace.

Abort inventory (module-local codes; framework aborts propagate): `EUNAUTHORIZED=1`, `EALREADY_INITIALIZED=2`, `ENOT_INITIALIZED=3`, `EINVALID_TOKEN=4`, `ENOT_DIRECT_OWNER=5`, `ETRANSFER_RESTRICTED=6`, `EESCROW_NOT_FOUND=7`, `EESCROW_MISMATCH=8`, `EINVALID_ROYALTY=9`.

Direct Aptos dependencies: `aptos_std::table::{Self, Table}`, `aptos_framework::object::{Self, ExtendRef}`, `aptos_token_objects::royalty`, `aptos_token_objects::token::{Self, Token}`. Standard library and same-package dependencies are visible in source imports.
