/// Digital Asset settlement using one isolated, untransferable escrow object per listing.
module marketplace::settlement_v2 {
    use std::option;
    use std::signer;
    use aptos_std::table::{Self, Table};
    use aptos_framework::object::{Self, ExtendRef};
    use aptos_token_objects::royalty;
    use aptos_token_objects::token::{Self, Token};
    use marketplace::marketplace;

    const EUNAUTHORIZED: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;
    const ENOT_INITIALIZED: u64 = 3;
    const EINVALID_TOKEN: u64 = 4;
    const ENOT_DIRECT_OWNER: u64 = 5;
    const ETRANSFER_RESTRICTED: u64 = 6;
    const EESCROW_NOT_FOUND: u64 = 7;
    const EESCROW_MISMATCH: u64 = 8;
    const EINVALID_ROYALTY: u64 = 9;

    const STANDARD_V2: u8 = 2;

    struct Escrow has store {
        authority: ExtendRef,
        escrow: address,
        token: address,
        collection: address,
    }

    struct Escrows has key {
        entries: Table<u64, Escrow>,
    }

    public entry fun initialize(publisher: &signer) {
        assert!(signer::address_of(publisher) == @marketplace, EUNAUTHORIZED);
        assert!(!exists<Escrows>(@marketplace), EALREADY_INITIALIZED);
        move_to(publisher, Escrows { entries: table::new() });
    }

    fun require_state() {
        assert!(exists<Escrows>(@marketplace), ENOT_INITIALIZED);
    }

    fun royalty_terms(token_object: object::Object<Token>): (address, u64, u64) {
        let maybe_royalty = token::royalty(token_object);
        if (option::is_some(&maybe_royalty)) {
            let value = option::destroy_some(maybe_royalty);
            let payee = royalty::payee_address(&value);
            let numerator = royalty::numerator(&value);
            let denominator = royalty::denominator(&value);
            assert!(denominator > 0 && numerator <= denominator, EINVALID_ROYALTY);
            assert!(numerator == 0 || payee != @0x0, EINVALID_ROYALTY);
            (payee, numerator, denominator)
        } else {
            option::destroy_none(maybe_royalty);
            (@0x0, 0, 1)
        }
    }

    public entry fun list(seller: &signer, token_address: address, price: u64) acquires Escrows {
        require_state();
        assert!(object::object_exists<Token>(token_address), EINVALID_TOKEN);
        let token_object = object::address_to_object<Token>(token_address);
        let seller_address = signer::address_of(seller);
        assert!(object::owner(token_object) == seller_address, ENOT_DIRECT_OWNER);
        assert!(object::ungated_transfer_allowed(token_object), ETRANSFER_RESTRICTED);
        let collection_object = token::collection_object(token_object);
        let collection_address = object::object_address(&collection_object);
        marketplace::assert_v2_collection_reviewed(collection_address);
        let (royalty_payee, royalty_numerator, royalty_denominator) = royalty_terms(token_object);

        let authority = object::create_unique_onchain_signer();
        let escrow_address = object::address_from_extend_ref(&authority);
        object::transfer(seller, token_object, escrow_address);
        assert!(object::owner(token_object) == escrow_address, EESCROW_MISMATCH);

        let identity = marketplace::new_v2_identity(token_address, collection_address);
        let listing_id = marketplace::create_listing(
            seller_address,
            identity,
            price,
            royalty_payee,
            royalty_numerator,
            royalty_denominator,
        );
        table::add(
            &mut borrow_global_mut<Escrows>(@marketplace).entries,
            listing_id,
            Escrow {
                authority,
                escrow: escrow_address,
                token: token_address,
                collection: collection_address,
            },
        );
    }

    fun take_escrow(listing_id: u64): Escrow acquires Escrows {
        require_state();
        let entries = &mut borrow_global_mut<Escrows>(@marketplace).entries;
        assert!(table::contains(entries, listing_id), EESCROW_NOT_FOUND);
        table::remove(entries, listing_id)
    }

    public entry fun cancel(seller: &signer, listing_id: u64) acquires Escrows {
        require_state();
        assert!(has_escrow(listing_id), EESCROW_NOT_FOUND);
        let asset = marketplace::cancel_listing(signer::address_of(seller), listing_id, STANDARD_V2);
        let Escrow { authority, escrow, token, collection } = take_escrow(listing_id);
        marketplace::assert_v2_identity(&asset, token, collection);
        let token_object = object::address_to_object<Token>(token);
        assert!(object::owner(token_object) == escrow, EESCROW_MISMATCH);
        let escrow_signer = object::generate_signer_for_extending(&authority);
        object::transfer(&escrow_signer, token_object, signer::address_of(seller));
        assert!(object::owner(token_object) == signer::address_of(seller), EESCROW_MISMATCH);
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
            STANDARD_V2,
        );
        let Escrow { authority, escrow, token, collection } = take_escrow(listing_id);
        marketplace::assert_v2_identity(&asset, token, collection);
        let token_object = object::address_to_object<Token>(token);
        assert!(object::owner(token_object) == escrow, EESCROW_MISMATCH);
        let escrow_signer = object::generate_signer_for_extending(&authority);
        object::transfer(&escrow_signer, token_object, signer::address_of(buyer));
        assert!(object::owner(token_object) == signer::address_of(buyer), EESCROW_MISMATCH);
    }

    #[view]
    public fun has_escrow(listing_id: u64): bool acquires Escrows {
        require_state();
        table::contains(&borrow_global<Escrows>(@marketplace).entries, listing_id)
    }

    #[view]
    public fun escrow_address(listing_id: u64): address acquires Escrows {
        require_state();
        let entries = &borrow_global<Escrows>(@marketplace).entries;
        assert!(table::contains(entries, listing_id), EESCROW_NOT_FOUND);
        table::borrow(entries, listing_id).escrow
    }

    #[view]
    public fun escrow_token(listing_id: u64): address acquires Escrows {
        require_state();
        let entries = &borrow_global<Escrows>(@marketplace).entries;
        assert!(table::contains(entries, listing_id), EESCROW_NOT_FOUND);
        table::borrow(entries, listing_id).token
    }

    #[test_only]
    public fun attempt_cross_escrow_transfer_for_test(
        authority_listing: u64,
        token_listing: u64,
        recipient: address,
    ) acquires Escrows {
        let entries = &borrow_global<Escrows>(@marketplace).entries;
        let authority = &table::borrow(entries, authority_listing).authority;
        let token_address = table::borrow(entries, token_listing).token;
        let escrow_signer = object::generate_signer_for_extending(authority);
        object::transfer(&escrow_signer, object::address_to_object<Token>(token_address), recipient);
    }

    #[test_only]
    public fun assert_minimal_escrow_for_test(listing_id: u64, expected_token: address) acquires Escrows {
        let entries = &borrow_global<Escrows>(@marketplace).entries;
        let escrow = table::borrow(entries, listing_id);
        assert!(escrow.token == expected_token, 100);
        assert!(object::address_from_extend_ref(&escrow.authority) == escrow.escrow, 101);
        assert!(!object::object_exists<object::ObjectCore>(escrow.escrow), 102);
    }
}
