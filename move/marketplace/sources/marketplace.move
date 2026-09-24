/// Standard-neutral fixed-price listing lifecycle and APT settlement.
/// Only package modules may construct identities or transition listings.
module marketplace::marketplace {
    use std::bcs;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use aptos_std::string_utils;
    use aptos_std::table::{Self, Table};
    use aptos_framework::aptos_account;
    use aptos_framework::event;
    use aptos_framework::object;
    use aptos_framework::timestamp;
    use aptos_token_objects::collection::{Self, Collection};
    use marketplace::marketplace_fee_policy;

    const ENOT_INITIALIZED: u64 = 1;
    const EUNAUTHORIZED: u64 = 2;
    const ELISTING_NOT_FOUND: u64 = 3;
    const ELISTING_NOT_ACTIVE: u64 = 4;
    const EPRICE_CHANGED: u64 = 5;
    const EASSET_ALREADY_LISTED: u64 = 6;
    const ESTANDARD_MISMATCH: u64 = 7;
    const ESELF_PURCHASE: u64 = 8;
    const EINVALID_ROYALTY: u64 = 9;
    const ECOLLECTION_NOT_REVIEWED: u64 = 10;
    const EINVALID_PROVENANCE: u64 = 11;
    const EINVALID_COLLECTION: u64 = 12;
    const EALREADY_INITIALIZED: u64 = 13;
    const ELISTING_ID_OVERFLOW: u64 = 14;

    const STANDARD_V1: u8 = 1;
    const STANDARD_V2: u8 = 2;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;
    const STATUS_SOLD: u8 = 3;
    const PROVENANCE_VEYTOS: u8 = 1;
    const PROVENANCE_THIRD_PARTY: u8 = 2;

    public struct AssetIdentity has copy, drop, store {
        standard: u8,
        v1_creator: address,
        v1_collection: String,
        v1_token: String,
        v1_property_version: u64,
        v2_token: address,
        collection: address,
    }

    struct Listing has store {
        id: u64,
        seller: address,
        asset: AssetIdentity,
        price: u64,
        fee_bps: u64,
        royalty_payee: address,
        royalty_numerator: u64,
        royalty_denominator: u64,
        created_at: u64,
        status: u8,
    }

    struct CollectionPolicy has copy, drop, store {
        reviewed: bool,
        provenance: u8,
    }

    struct State has key {
        next_listing_id: u64,
        listings: Table<u64, Listing>,
        active_assets: Table<vector<u8>, u64>,
        v2_collections: Table<address, CollectionPolicy>,
    }

    #[event]
    struct NFTListed has drop, store {
        listing_id: u64,
        asset: AssetIdentity,
        seller: address,
        gross_price: u64,
        fee_bps: u64,
        royalty_payee: address,
        royalty_numerator: u64,
        royalty_denominator: u64,
        timestamp: u64,
    }

    #[event]
    struct ListingCancelled has drop, store {
        listing_id: u64,
        asset: AssetIdentity,
        seller: address,
        timestamp: u64,
    }

    #[event]
    struct NFTPurchased has drop, store {
        listing_id: u64,
        asset: AssetIdentity,
        seller: address,
        buyer: address,
        gross_price: u64,
        platform_fee_recipient: address,
        platform_fee: u64,
        royalty_recipient: address,
        royalty: u64,
        seller_proceeds: u64,
        timestamp: u64,
    }

    #[event]
    struct V2CollectionPolicyUpdated has drop, store {
        collection: address,
        reviewed: bool,
        provenance: u8,
    }

    public entry fun initialize(publisher: &signer) {
        assert!(signer::address_of(publisher) == @marketplace, EUNAUTHORIZED);
        assert!(!exists<State>(@marketplace), EALREADY_INITIALIZED);
        move_to(publisher, State {
            next_listing_id: 1,
            listings: table::new(),
            active_assets: table::new(),
            v2_collections: table::new(),
        });
    }

    fun require_state() {
        assert!(exists<State>(@marketplace), ENOT_INITIALIZED);
    }

    fun asset_key(asset: &AssetIdentity): vector<u8> {
        bcs::to_bytes(asset)
    }

    fun assert_standard_open(standard: u8) {
        if (standard == STANDARD_V1) {
            marketplace_fee_policy::assert_v1_open();
        } else {
            assert!(standard == STANDARD_V2, ESTANDARD_MISMATCH);
            marketplace_fee_policy::assert_v2_open();
        }
    }

    fun assert_reviewed_v2(asset: &AssetIdentity) acquires State {
        if (asset.standard == STANDARD_V2) {
            let policies = &borrow_global<State>(@marketplace).v2_collections;
            assert!(table::contains(policies, asset.collection), ECOLLECTION_NOT_REVIEWED);
            assert!(table::borrow(policies, asset.collection).reviewed, ECOLLECTION_NOT_REVIEWED);
        }
    }

    public(package) fun assert_v2_collection_reviewed(collection_address: address) acquires State {
        require_state();
        let policies = &borrow_global<State>(@marketplace).v2_collections;
        assert!(table::contains(policies, collection_address), ECOLLECTION_NOT_REVIEWED);
        assert!(table::borrow(policies, collection_address).reviewed, ECOLLECTION_NOT_REVIEWED);
    }

    public(package) fun new_v1_identity(
        creator: address,
        collection_name: String,
        token_name: String,
        property_version: u64,
    ): AssetIdentity {
        AssetIdentity {
            standard: STANDARD_V1,
            v1_creator: creator,
            v1_collection: collection_name,
            v1_token: token_name,
            v1_property_version: property_version,
            v2_token: @0x0,
            collection: creator,
        }
    }

    public(package) fun new_v2_identity(token: address, collection: address): AssetIdentity {
        AssetIdentity {
            standard: STANDARD_V2,
            v1_creator: @0x0,
            v1_collection: string::utf8(b""),
            v1_token: string::utf8(b""),
            v1_property_version: 0,
            v2_token: token,
            collection,
        }
    }

    public(package) fun assert_v2_identity(
        asset: &AssetIdentity,
        token: address,
        collection: address,
    ) {
        assert!(asset.standard == STANDARD_V2, ESTANDARD_MISMATCH);
        assert!(asset.v2_token == token && asset.collection == collection, ESTANDARD_MISMATCH);
    }

    public(package) fun create_listing(
        seller: address,
        asset: AssetIdentity,
        price: u64,
        royalty_payee: address,
        royalty_numerator: u64,
        royalty_denominator: u64,
    ): u64 acquires State {
        require_state();
        assert_standard_open(asset.standard);
        assert_reviewed_v2(&asset);
        assert!(royalty_denominator > 0, EINVALID_ROYALTY);
        assert!(royalty_numerator <= royalty_denominator, EINVALID_ROYALTY);
        assert!(royalty_numerator == 0 || royalty_payee != @0x0, EINVALID_ROYALTY);
        let fee_bps = marketplace_fee_policy::fee_bps();
        marketplace_fee_policy::quote_sale(price, fee_bps, royalty_numerator, royalty_denominator);
        let key = asset_key(&asset);
        let state = borrow_global_mut<State>(@marketplace);
        assert!(!table::contains(&state.active_assets, key), EASSET_ALREADY_LISTED);
        let id = state.next_listing_id;
        assert!(id < 18446744073709551615, ELISTING_ID_OVERFLOW);
        state.next_listing_id = id + 1;
        let created_at = timestamp::now_seconds();
        table::add(&mut state.active_assets, key, id);
        table::add(&mut state.listings, id, Listing {
            id,
            seller,
            asset,
            price,
            fee_bps,
            royalty_payee,
            royalty_numerator,
            royalty_denominator,
            created_at,
            status: STATUS_ACTIVE,
        });
        event::emit(NFTListed {
            listing_id: id,
            asset,
            seller,
            gross_price: price,
            fee_bps,
            royalty_payee,
            royalty_numerator,
            royalty_denominator,
            timestamp: created_at,
        });
        id
    }

    inline fun active_listing_mut(id: u64, expected_standard: u8): &mut Listing {
        require_state();
        let state = borrow_global_mut<State>(@marketplace);
        assert!(table::contains(&state.listings, id), ELISTING_NOT_FOUND);
        let listing = table::borrow_mut(&mut state.listings, id);
        assert!(listing.status == STATUS_ACTIVE, ELISTING_NOT_ACTIVE);
        assert!(listing.asset.standard == expected_standard, ESTANDARD_MISMATCH);
        listing
    }

    public(package) fun cancel_listing(
        seller: address,
        id: u64,
        expected_standard: u8,
    ): AssetIdentity acquires State {
        let listing = active_listing_mut(id, expected_standard);
        assert!(listing.seller == seller, EUNAUTHORIZED);
        listing.status = STATUS_CANCELLED;
        let asset = listing.asset;
        let recorded_seller = listing.seller;
        let key = asset_key(&asset);
        let removed_id = table::remove(&mut borrow_global_mut<State>(@marketplace).active_assets, key);
        assert!(removed_id == id, ELISTING_NOT_ACTIVE);
        event::emit(ListingCancelled {
            listing_id: id,
            asset,
            seller: recorded_seller,
            timestamp: timestamp::now_seconds(),
        });
        asset
    }

    public(package) fun buy_listing(
        buyer: &signer,
        id: u64,
        expected_price: u64,
        expected_standard: u8,
    ): AssetIdentity acquires State {
        assert_standard_open(expected_standard);
        let listing = active_listing_mut(id, expected_standard);
        assert!(listing.price == expected_price, EPRICE_CHANGED);
        let buyer_address = signer::address_of(buyer);
        assert!(buyer_address != listing.seller, ESELF_PURCHASE);
        let seller = listing.seller;
        let asset = listing.asset;
        let gross = listing.price;
        let royalty_payee = listing.royalty_payee;
        let (fee, royalty, seller_proceeds) = marketplace_fee_policy::quote_sale(
            gross,
            listing.fee_bps,
            listing.royalty_numerator,
            listing.royalty_denominator,
        );
        let fee_recipient = marketplace_fee_policy::recipient();
        if (fee > 0) aptos_account::transfer(buyer, fee_recipient, fee);
        if (royalty > 0) aptos_account::transfer(buyer, royalty_payee, royalty);
        aptos_account::transfer(buyer, seller, seller_proceeds);
        listing.status = STATUS_SOLD;
        let key = asset_key(&asset);
        let removed_id = table::remove(&mut borrow_global_mut<State>(@marketplace).active_assets, key);
        assert!(removed_id == id, ELISTING_NOT_ACTIVE);
        event::emit(NFTPurchased {
            listing_id: id,
            asset,
            seller,
            buyer: buyer_address,
            gross_price: gross,
            platform_fee_recipient: fee_recipient,
            platform_fee: fee,
            royalty_recipient: royalty_payee,
            royalty,
            seller_proceeds,
            timestamp: timestamp::now_seconds(),
        });
        asset
    }

    public entry fun set_v2_collection_reviewed(
        caller: &signer,
        collection_address: address,
        provenance: u8,
        reviewed: bool,
    ) acquires State {
        require_state();
        assert!(signer::address_of(caller) == marketplace_fee_policy::admin(), EUNAUTHORIZED);
        assert!(provenance == PROVENANCE_VEYTOS || provenance == PROVENANCE_THIRD_PARTY, EINVALID_PROVENANCE);
        assert!(collection_address != @0x0, EINVALID_COLLECTION);
        assert!(object::object_exists<Collection>(collection_address), EINVALID_COLLECTION);
        let collection_object = object::address_to_object<Collection>(collection_address);
        collection::name(collection_object);
        set_policy(collection_address, reviewed, provenance);
    }

    fun set_policy(collection_address: address, reviewed: bool, provenance: u8) acquires State {
        let policies = &mut borrow_global_mut<State>(@marketplace).v2_collections;
        if (table::contains(policies, collection_address)) {
            let policy = table::borrow_mut(policies, collection_address);
            policy.reviewed = reviewed;
            policy.provenance = provenance;
        } else {
            table::add(policies, collection_address, CollectionPolicy { reviewed, provenance });
        };
        event::emit(V2CollectionPolicyUpdated {
            collection: collection_address,
            reviewed,
            provenance,
        });
    }

    #[view]
    public fun v2_collection_policy(collection_address: address): (bool, u8) acquires State {
        require_state();
        let policies = &borrow_global<State>(@marketplace).v2_collections;
        if (table::contains(policies, collection_address)) {
            let policy = table::borrow(policies, collection_address);
            (policy.reviewed, policy.provenance)
        } else {
            (false, 0)
        }
    }

    #[view]
    public fun listing_terms(id: u64): (address, u8, u64, u64, address, u64, u64, u8) acquires State {
        require_state();
        let state = borrow_global<State>(@marketplace);
        assert!(table::contains(&state.listings, id), ELISTING_NOT_FOUND);
        let listing = table::borrow(&state.listings, id);
        (
            listing.seller,
            listing.asset.standard,
            listing.price,
            listing.fee_bps,
            listing.royalty_payee,
            listing.royalty_numerator,
            listing.royalty_denominator,
            listing.status,
        )
    }

    #[view]
    public fun listing_asset(id: u64): AssetIdentity acquires State {
        require_state();
        let state = borrow_global<State>(@marketplace);
        assert!(table::contains(&state.listings, id), ELISTING_NOT_FOUND);
        table::borrow(&state.listings, id).asset
    }

    public fun v2_identity_parts(asset: AssetIdentity): (address, address) {
        assert!(asset.standard == STANDARD_V2, ESTANDARD_MISMATCH);
        (asset.v2_token, asset.collection)
    }

    #[view]
    public fun listing_status(id: u64): u8 acquires State {
        let (_, _, _, _, _, _, _, status) = listing_terms(id);
        status
    }

    #[view]
    public fun listing_price(id: u64): u64 acquires State {
        let (_, _, price, _, _, _, _, _) = listing_terms(id);
        price
    }

    #[view]
    public fun listing_fee_bps(id: u64): u64 acquires State {
        let (_, _, _, fee_bps, _, _, _, _) = listing_terms(id);
        fee_bps
    }

    #[view]
    public fun next_listing_id(): u64 acquires State {
        require_state();
        borrow_global<State>(@marketplace).next_listing_id
    }

    public fun is_active_asset(asset: AssetIdentity): bool acquires State {
        require_state();
        table::contains(&borrow_global<State>(@marketplace).active_assets, asset_key(&asset))
    }

    #[test_only]
    public fun new_v1_identity_for_test(creator: address, seed: u64, property_version: u64): AssetIdentity {
        new_v1_identity(
            creator,
            string_utils::to_string(&seed),
            string_utils::to_string(&seed),
            property_version,
        )
    }

    #[test_only]
    public fun new_v2_identity_for_test(token: address, collection: address): AssetIdentity {
        new_v2_identity(token, collection)
    }

    #[test_only]
    public fun set_v2_reviewed_for_test(collection_address: address, provenance: u8) acquires State {
        set_policy(collection_address, true, provenance)
    }

    #[test_only]
    public fun assert_events_for_test(
        cancelled_id: u64,
        sold_id: u64,
        seller: address,
        buyer: address,
        price: u64,
        fee: u64,
        royalty: u64,
        seller_proceeds: u64,
    ) {
        let listed = event::emitted_events<NFTListed>();
        assert!(vector::length(&listed) == 2, 100);
        assert!(vector::borrow(&listed, 0).listing_id == cancelled_id, 101);
        assert!(vector::borrow(&listed, 1).listing_id == sold_id, 102);
        let cancelled = event::emitted_events<ListingCancelled>();
        assert!(vector::length(&cancelled) == 1, 103);
        assert!(vector::borrow(&cancelled, 0).seller == seller, 104);
        let purchased = event::emitted_events<NFTPurchased>();
        assert!(vector::length(&purchased) == 1, 105);
        let sale = vector::borrow(&purchased, 0);
        assert!(sale.listing_id == sold_id && sale.seller == seller && sale.buyer == buyer, 106);
        assert!(sale.gross_price == price && sale.platform_fee == fee, 107);
        assert!(sale.royalty == royalty && sale.seller_proceeds == seller_proceeds, 108);
    }
}
