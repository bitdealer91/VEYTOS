/// Token V1 settlement using direct custody of one exact linear Token value.
module marketplace::settlement_v1 {
    use std::signer;
    use std::string::String;
    use aptos_std::table::{Self, Table};
    use aptos_token::token::{Self, Token, TokenId};
    use marketplace::marketplace;

    const EUNAUTHORIZED: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;
    const ENOT_INITIALIZED: u64 = 3;
    const ENOT_UNIQUE_NFT: u64 = 4;
    const ENOT_EXACT_OWNER: u64 = 5;
    const EINVALID_ROYALTY: u64 = 6;
    const EESCROW_NOT_FOUND: u64 = 7;
    const EESCROW_MISMATCH: u64 = 8;

    const STANDARD_V1: u8 = 1;

    struct Escrows has key {
        entries: Table<u64, Token>,
    }

    public entry fun initialize(publisher: &signer) {
        assert!(signer::address_of(publisher) == @marketplace, EUNAUTHORIZED);
        assert!(!exists<Escrows>(@marketplace), EALREADY_INITIALIZED);
        move_to(publisher, Escrows { entries: table::new() });
    }

    fun require_state() {
        assert!(exists<Escrows>(@marketplace), ENOT_INITIALIZED);
    }

    fun assert_identity(
        token_id: &TokenId,
        creator: address,
        collection_name: String,
        token_name: String,
        property_version: u64,
    ) {
        let (actual_creator, actual_collection, actual_name, actual_version) =
            token::get_token_id_fields(token_id);
        assert!(
            actual_creator == creator
                && actual_collection == collection_name
                && actual_name == token_name
                && actual_version == property_version,
            EESCROW_MISMATCH,
        );
    }

    public entry fun list(
        seller: &signer,
        creator: address,
        collection_name: String,
        token_name: String,
        property_version: u64,
        price: u64,
    ) acquires Escrows {
        require_state();
        let seller_address = signer::address_of(seller);
        let token_id = token::create_token_id_raw(
            creator,
            collection_name,
            token_name,
            property_version,
        );
        let token_data_id = token::create_token_data_id(creator, collection_name, token_name);
        assert!(token::get_tokendata_maximum(token_data_id) == 1, ENOT_UNIQUE_NFT);
        assert!(token::balance_of(seller_address, token_id) == 1, ENOT_EXACT_OWNER);

        let royalty = token::get_royalty(token_id);
        let royalty_payee = token::get_royalty_payee(&royalty);
        let royalty_numerator = token::get_royalty_numerator(&royalty);
        let royalty_denominator = token::get_royalty_denominator(&royalty);
        assert!(royalty_denominator > 0 && royalty_numerator <= royalty_denominator, EINVALID_ROYALTY);
        assert!(royalty_numerator == 0 || royalty_payee != @0x0, EINVALID_ROYALTY);

        let escrowed = token::withdraw_token(seller, token_id, 1);
        assert!(token::get_token_amount(&escrowed) == 1, EESCROW_MISMATCH);
        assert_identity(
            token::token_id(&escrowed),
            creator,
            collection_name,
            token_name,
            property_version,
        );
        let identity = marketplace::new_v1_identity(
            creator,
            collection_name,
            token_name,
            property_version,
        );
        let listing_id = marketplace::create_listing(
            seller_address,
            identity,
            price,
            royalty_payee,
            royalty_numerator,
            royalty_denominator,
        );
        table::add(&mut borrow_global_mut<Escrows>(@marketplace).entries, listing_id, escrowed);
    }

    fun take_escrow(listing_id: u64): Token acquires Escrows {
        require_state();
        let entries = &mut borrow_global_mut<Escrows>(@marketplace).entries;
        assert!(table::contains(entries, listing_id), EESCROW_NOT_FOUND);
        table::remove(entries, listing_id)
    }

    fun assert_asset_matches_token(asset: &marketplace::AssetIdentity, token_value: &Token) {
        let (creator, collection_name, token_name, property_version) =
            token::get_token_id_fields(token::token_id(token_value));
        marketplace::assert_v1_identity(
            asset,
            creator,
            collection_name,
            token_name,
            property_version,
        );
        assert!(token::get_token_amount(token_value) == 1, EESCROW_MISMATCH);
    }

    public entry fun cancel(seller: &signer, listing_id: u64) acquires Escrows {
        require_state();
        assert!(has_escrow(listing_id), EESCROW_NOT_FOUND);
        let asset = marketplace::cancel_listing(signer::address_of(seller), listing_id, STANDARD_V1);
        let escrowed = take_escrow(listing_id);
        assert_asset_matches_token(&asset, &escrowed);
        token::deposit_token(seller, escrowed);
    }

    public entry fun buy(
        buyer: &signer,
        listing_id: u64,
        expected_price: u64,
        expected_storage_reimbursement: u64,
    ) acquires Escrows {
        require_state();
        assert!(has_escrow(listing_id), EESCROW_NOT_FOUND);
        let asset = marketplace::buy_listing(
            buyer,
            listing_id,
            expected_price,
            expected_storage_reimbursement,
            STANDARD_V1,
        );
        let escrowed = take_escrow(listing_id);
        assert_asset_matches_token(&asset, &escrowed);
        token::deposit_token(buyer, escrowed);
    }

    #[view]
    public fun has_escrow(listing_id: u64): bool acquires Escrows {
        require_state();
        table::contains(&borrow_global<Escrows>(@marketplace).entries, listing_id)
    }

    #[view]
    public fun escrow_token_id(listing_id: u64): (address, String, String, u64) acquires Escrows {
        require_state();
        let entries = &borrow_global<Escrows>(@marketplace).entries;
        assert!(table::contains(entries, listing_id), EESCROW_NOT_FOUND);
        token::get_token_id_fields(token::token_id(table::borrow(entries, listing_id)))
    }

    #[view]
    public fun escrow_amount(listing_id: u64): u64 acquires Escrows {
        require_state();
        let entries = &borrow_global<Escrows>(@marketplace).entries;
        assert!(table::contains(entries, listing_id), EESCROW_NOT_FOUND);
        token::get_token_amount(table::borrow(entries, listing_id))
    }
}
