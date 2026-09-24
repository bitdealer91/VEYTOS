#[test_only]
module marketplace::settlement_v2_tests {
    use std::option;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::object::{Self, TransferRef};
    use aptos_framework::timestamp;
    use aptos_token_objects::collection::{Self, Collection};
    use aptos_token_objects::royalty::{Self, MutatorRef};
    use aptos_token_objects::token::{Self, Token};
    use marketplace::marketplace_fee_policy;
    use marketplace::marketplace;
    use marketplace::settlement_v2;

    const PRICE: u64 = 100000000;

    fun setup(): (signer, signer, signer, signer, address) {
        let framework = account::create_account_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&framework);
        timestamp::update_global_time_for_test_secs(100);
        let admin = account::create_account_for_test(@marketplace);
        let seller = account::create_account_for_test(@0xa);
        let buyer = account::create_account_for_test(@0xb);
        let attacker = account::create_account_for_test(@0xd);
        marketplace_fee_policy::initialize(&admin, @0xc);
        marketplace::initialize(&admin);
        settlement_v2::initialize(&admin);
        aptos_account::deposit_fungible_assets(@0xb, aptos_coin::mint_apt_fa_for_test(100000000000));
        let constructor = collection::create_fixed_collection(
            &seller,
            string::utf8(b"description"),
            100,
            string::utf8(b"V2 Collection"),
            option::some(royalty::create(500, 10000, @0xf)),
            string::utf8(b"ipfs://collection"),
        );
        let collection_address = object::address_from_constructor_ref(&constructor);
        marketplace::set_v2_collection_reviewed(&admin, collection_address, 1, true);
        (admin, seller, buyer, attacker, collection_address)
    }

    fun mint(seller: &signer, collection_address: address, name: vector<u8>): address {
        let constructor = token::create_token(
            seller,
            object::address_to_object<Collection>(collection_address),
            string::utf8(b"description"),
            string::utf8(name),
            option::none(),
            string::utf8(b"ipfs://token"),
        );
        object::address_from_constructor_ref(&constructor)
    }

    fun list(seller: &signer, token_address: address): u64 {
        let id = marketplace::next_listing_id();
        settlement_v2::list(seller, token_address, PRICE);
        id
    }

    #[test]
    fun v201_successful_listing() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        let escrow = settlement_v2::escrow_address(id);
        assert!(id == 1, 100);
        assert!(object::owner(object::address_to_object<Token>(token_address)) == escrow, 101);
        assert!(!object::object_exists<object::ObjectCore>(escrow), 102);
        assert!(marketplace::listing_status(id) == 1, 103);
    }

    #[test]
    fun v202_successful_cancel() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::cancel(&seller, id);
        assert!(object::owner(object::address_to_object<Token>(token_address)) == @0xa, 100);
        assert!(marketplace::listing_status(id) == 2, 101);
        assert!(!settlement_v2::has_escrow(id), 102);
    }

    #[test]
    fun v203_successful_buy() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        assert!(object::owner(object::address_to_object<Token>(token_address)) == @0xb, 100);
        assert!(marketplace::listing_status(id) == 3, 101);
        assert!(coin::balance<AptosCoin>(@0xa) == 93926400, 102);
        assert!(coin::balance<AptosCoin>(@0xc) == 2000000, 103);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 104);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = marketplace::settlement_v2)]
    fun v204_unowned_object() {
        let (_, seller, _, attacker, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        settlement_v2::list(&attacker, token_address, PRICE);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = marketplace::settlement_v2)]
    fun v205_nested_ownership() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let parent = object::create_sticky_object(@0xa);
        let parent_address = object::address_from_constructor_ref(&parent);
        object::transfer(&seller, object::address_to_object<Token>(token_address), parent_address);
        settlement_v2::list(&seller, token_address, PRICE);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = marketplace::settlement_v2)]
    fun v206_wrong_resource_type() {
        let (_, seller, _, _, _) = setup();
        let plain = object::create_sticky_object(@0xa);
        settlement_v2::list(&seller, object::address_from_constructor_ref(&plain), PRICE);
    }

    #[test]
    fun v207_collection_identity() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        let (recorded_token, recorded_collection) = marketplace::v2_identity_parts(marketplace::listing_asset(id));
        assert!(recorded_token == token_address && recorded_collection == collection_address, 100);
    }

    #[test]
    #[expected_failure(abort_code = 6, location = marketplace::settlement_v2)]
    fun v208_ungated_transfer_disabled() {
        let (_, seller, _, _, collection_address) = setup();
        let constructor = token::create_token(
            &seller,
            object::address_to_object<Collection>(collection_address),
            string::utf8(b"description"),
            string::utf8(b"restricted"),
            option::none(),
            string::utf8(b"ipfs://restricted"),
        );
        let transfer_ref = object::generate_transfer_ref(&constructor);
        object::disable_ungated_transfer(&transfer_ref);
        settlement_v2::list(&seller, object::address_from_constructor_ref(&constructor), PRICE);
    }

    #[test]
    fun v209_token_level_royalty() {
        let (_, seller, buyer, _, collection_address) = setup();
        let constructor = token::create_token(
            &seller,
            object::address_to_object<Collection>(collection_address),
            string::utf8(b"description"),
            string::utf8(b"token royalty"),
            option::some(royalty::create(1000, 10000, @0xd)),
            string::utf8(b"ipfs://token"),
        );
        let id = list(&seller, object::address_from_constructor_ref(&constructor));
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        assert!(coin::balance<AptosCoin>(@0xd) == 10000000, 100);
        assert!(coin::balance<AptosCoin>(@0xf) == 0, 101);
    }

    #[test]
    fun v210_inherited_royalty() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 100);
    }

    #[test]
    fun v211_no_royalty() {
        let (admin, seller, buyer, _, _) = setup();
        let constructor = collection::create_fixed_collection(
            &seller,
            string::utf8(b"description"),
            1,
            string::utf8(b"No Royalty"),
            option::none(),
            string::utf8(b"ipfs://none"),
        );
        let collection_address = object::address_from_constructor_ref(&constructor);
        marketplace::set_v2_collection_reviewed(&admin, collection_address, 2, true);
        let token_address = mint(&seller, collection_address, b"one");
        settlement_v2::buy(&buyer, list(&seller, token_address), PRICE, 926400);
        assert!(coin::balance<AptosCoin>(@0xa) == 98926400, 100);
    }

    fun mint_mutable_royalty(
        seller: &signer,
        collection_address: address,
    ): (address, MutatorRef) {
        let constructor = token::create_token(
            seller,
            object::address_to_object<Collection>(collection_address),
            string::utf8(b"description"),
            string::utf8(b"mutable"),
            option::some(royalty::create(500, 10000, @0xf)),
            string::utf8(b"ipfs://mutable"),
        );
        let address = object::address_from_constructor_ref(&constructor);
        let mutator = royalty::generate_mutator_ref(object::generate_extend_ref(&constructor));
        (address, mutator)
    }

    #[test]
    fun v212_mutable_royalty_snapshot() {
        let (_, seller, buyer, _, collection_address) = setup();
        let (token_address, mutator) = mint_mutable_royalty(&seller, collection_address);
        let id = list(&seller, token_address);
        royalty::update(&mutator, royalty::create(1000, 10000, @0xd));
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 100);
        assert!(coin::balance<AptosCoin>(@0xd) == 0, 101);
    }

    #[test]
    #[expected_failure]
    fun v213_isolated_capability_scope() {
        let (_, seller, _, _, collection_address) = setup();
        let first = mint(&seller, collection_address, b"one");
        let second = mint(&seller, collection_address, b"two");
        let first_id = list(&seller, first);
        let second_id = list(&seller, second);
        settlement_v2::attempt_cross_escrow_transfer_for_test(first_id, second_id, @0xd);
    }

    #[test]
    fun v214_no_nft_capabilities_retained() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::assert_minimal_escrow_for_test(id, token_address);
    }

    #[test]
    #[expected_failure]
    fun v215_seller_cannot_move_escrowed_nft() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        list(&seller, token_address);
        object::transfer(&seller, object::address_to_object<Token>(token_address), @0xd);
    }

    #[test]
    #[expected_failure]
    fun v216_admin_cannot_move_escrow() {
        let (admin, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        list(&seller, token_address);
        object::transfer(&admin, object::address_to_object<Token>(token_address), @0xd);
    }

    #[test]
    fun v217_reviewed_collection_registry() {
        let (admin, seller, _, _, collection_address) = setup();
        let (reviewed, provenance) = marketplace::v2_collection_policy(collection_address);
        assert!(reviewed && provenance == 1, 100);
        marketplace::set_v2_collection_reviewed(&admin, collection_address, 1, false);
        let (reviewed, provenance) = marketplace::v2_collection_policy(collection_address);
        assert!(!reviewed && provenance == 1, 101);
        let token_address = mint(&seller, collection_address, b"one");
        assert!(object::owner(object::address_to_object<Token>(token_address)) == @0xa, 102);
    }

    #[test]
    #[expected_failure(abort_code = 10, location = marketplace::marketplace)]
    fun v218_unreviewed_collection_rejected() {
        let (admin, seller, _, _, collection_address) = setup();
        marketplace::set_v2_collection_reviewed(&admin, collection_address, 1, false);
        let token_address = mint(&seller, collection_address, b"one");
        list(&seller, token_address);
    }

    fun mint_with_transfer_ref(
        seller: &signer,
        collection_address: address,
    ): (address, TransferRef) {
        let constructor = token::create_token(
            seller,
            object::address_to_object<Collection>(collection_address),
            string::utf8(b"description"),
            string::utf8(b"retained"),
            option::none(),
            string::utf8(b"ipfs://retained"),
        );
        let address = object::address_from_constructor_ref(&constructor);
        let transfer_ref = object::generate_transfer_ref(&constructor);
        (address, transfer_ref)
    }

    #[test]
    fun v219_retained_creator_transfer_ref_threat() {
        let (_, seller, _, _, collection_address) = setup();
        let (token_address, transfer_ref) = mint_with_transfer_ref(&seller, collection_address);
        list(&seller, token_address);
        let linear = object::generate_linear_transfer_ref(&transfer_ref);
        object::transfer_with_ref(linear, @0xd);
        assert!(object::owner(object::address_to_object<Token>(token_address)) == @0xd, 100);
    }

    #[test]
    fun v220_unrelated_assets_untouched() {
        let (_, seller, buyer, _, collection_address) = setup();
        let listed = mint(&seller, collection_address, b"one");
        let unrelated = mint(&seller, collection_address, b"two");
        let id = list(&seller, listed);
        assert!(object::owner(object::address_to_object<Token>(unrelated)) == @0xa, 100);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        assert!(object::owner(object::address_to_object<Token>(unrelated)) == @0xa, 101);
    }

    #[test]
    #[expected_failure(abort_code = 0x20002, location = aptos_token_objects::royalty)]
    fun v221_malformed_native_royalty_rejected_at_source() {
        royalty::create(2, 1, @0xf);
    }

    #[test]
    fun v222_pause_does_not_trap_cancellation() {
        let (admin, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        marketplace_fee_policy::set_global_paused(&admin, true);
        marketplace_fee_policy::set_v2_paused(&admin, true);
        settlement_v2::cancel(&seller, id);
        assert!(object::owner(object::address_to_object<Token>(token_address)) == @0xa, 100);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = marketplace::marketplace)]
    fun v223_wrong_expected_price() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        settlement_v2::buy(&buyer, list(&seller, token_address), PRICE - 1, 926400);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = marketplace::settlement_v2)]
    fun v224_cancel_then_buy_fails() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::cancel(&seller, id);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = marketplace::settlement_v2)]
    fun v225_buy_then_cancel_fails() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        settlement_v2::cancel(&seller, id);
    }

    #[test]
    #[expected_failure(abort_code = 11, location = marketplace::marketplace_fee_policy)]
    fun v226_v2_pause_blocks_listing() {
        let (admin, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        marketplace_fee_policy::set_v2_paused(&admin, true);
        list(&seller, token_address);
    }

    #[test]
    #[expected_failure(abort_code = 11, location = marketplace::marketplace_fee_policy)]
    fun v227_global_pause_blocks_buy() {
        let (admin, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        marketplace_fee_policy::set_global_paused(&admin, true);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
    }

    #[test]
    fun v228_revocation_does_not_trap_existing_escrow() {
        let (admin, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        marketplace::set_v2_collection_reviewed(&admin, collection_address, 1, false);
        settlement_v2::cancel(&seller, id);
        assert!(object::owner(object::address_to_object<Token>(token_address)) == @0xa, 100);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = marketplace::marketplace)]
    fun v229_nonadmin_cannot_update_registry() {
        let (_, _, _, attacker, collection_address) = setup();
        marketplace::set_v2_collection_reviewed(&attacker, collection_address, 2, false);
    }

    #[test]
    #[expected_failure(abort_code = 12, location = marketplace::marketplace)]
    fun v230_noncollection_registry_entry_rejected() {
        let (admin, _, _, _, _) = setup();
        let plain = object::create_sticky_object(@0xa);
        marketplace::set_v2_collection_reviewed(
            &admin,
            object::address_from_constructor_ref(&plain),
            2,
            true,
        );
    }

    #[test]
    #[expected_failure]
    fun v231_insufficient_payment_aborts_purchase() {
        let (_, seller, _, attacker, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::buy(&attacker, id, PRICE, 926400);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = marketplace::settlement_v2)]
    fun v232_double_buy_fails() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
        settlement_v2::buy(&buyer, id, PRICE, 926400);
    }

    #[test]
    #[expected_failure(abort_code = 15, location = marketplace::marketplace)]
    fun v233_wrong_storage_reimbursement_leaves_purchase_unexecutable() {
        let (_, seller, buyer, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        settlement_v2::buy(&buyer, id, PRICE, 1);
    }

    #[test]
    fun v234_lightweight_escrow_has_no_terminal_shell() {
        let (_, seller, _, _, collection_address) = setup();
        let token_address = mint(&seller, collection_address, b"one");
        let id = list(&seller, token_address);
        let escrow = settlement_v2::escrow_address(id);
        assert!(!object::object_exists<object::ObjectCore>(escrow), 100);
        settlement_v2::cancel(&seller, id);
        assert!(!object::object_exists<object::ObjectCore>(escrow), 101);
        assert!(marketplace::listing_status(id) == 2, 102);
    }
}
