#[test_only]
module marketplace::settlement_v1_tests {
    use std::signer;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_token::token::{Self, TokenId};
    use marketplace::marketplace;
    use marketplace::marketplace_fee_policy;
    use marketplace::settlement_v1;

    const PRICE: u64 = 100000000;

    fun setup(): (signer, signer, signer, signer) {
        let framework = account::create_account_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&framework);
        timestamp::update_global_time_for_test_secs(100);
        let admin = account::create_account_for_test(@marketplace);
        let seller = account::create_account_for_test(@0xa);
        let buyer = account::create_account_for_test(@0xb);
        let attacker = account::create_account_for_test(@0xd);
        marketplace_fee_policy::initialize(&admin, @0xc);
        marketplace::initialize(&admin);
        settlement_v1::initialize(&admin);
        aptos_account::deposit_fungible_assets(@0xb, aptos_coin::mint_apt_fa_for_test(100000000000));
        create_collection(&seller);
        (admin, seller, buyer, attacker)
    }

    fun create_collection(seller: &signer) {
        token::create_collection(
            seller,
            string::utf8(b"V1 Collection"),
            string::utf8(b"description"),
            string::utf8(b"ipfs://collection"),
            100,
            vector[false, false, false],
        );
    }

    fun mint_with(
        seller: &signer,
        name: vector<u8>,
        maximum: u64,
        royalty_numerator: u64,
        royalty_denominator: u64,
        royalty_mutable: bool,
        properties_mutable: bool,
    ): TokenId {
        let token_data_id = token::create_tokendata(
            seller,
            string::utf8(b"V1 Collection"),
            string::utf8(name),
            string::utf8(b"description"),
            maximum,
            string::utf8(b"ipfs://token"),
            @0xf,
            royalty_denominator,
            royalty_numerator,
            token::create_token_mutability_config(
                &vector[false, false, royalty_mutable, false, properties_mutable],
            ),
            vector[],
            vector[],
            vector[],
        );
        token::mint_token(seller, token_data_id, 1)
    }

    fun mint(seller: &signer, name: vector<u8>): TokenId {
        mint_with(seller, name, 1, 500, 10000, false, false)
    }

    fun list(seller: &signer, name: vector<u8>, property_version: u64): u64 {
        let id = marketplace::next_listing_id();
        settlement_v1::list(
            seller,
            @0xa,
            string::utf8(b"V1 Collection"),
            string::utf8(name),
            property_version,
            PRICE,
        );
        id
    }

    #[test]
    fun v101_successful_escrow() {
        let (_, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        assert!(token::balance_of(@0xa, token_id) == 0, 100);
        assert!(settlement_v1::has_escrow(id), 101);
        assert!(settlement_v1::escrow_amount(id) == 1, 102);
    }

    #[test]
    fun v102_cancel_returns_exact_token() {
        let (_, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        settlement_v1::cancel(&seller, id);
        assert!(token::balance_of(@0xa, token_id) == 1, 100);
        assert!(!settlement_v1::has_escrow(id), 101);
        assert!(marketplace::listing_status(id) == 2, 102);
    }

    #[test]
    fun v103_buy_delivers_exact_token() {
        let (_, seller, buyer, _) = setup();
        let token_id = mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        settlement_v1::buy(&buyer, id, PRICE, 0);
        assert!(token::balance_of(@0xb, token_id) == 1, 100);
        assert!(marketplace::listing_status(id) == 3, 101);
        assert!(coin::balance<AptosCoin>(@0xa) == 93000000, 102);
        assert!(coin::balance<AptosCoin>(@0xc) == 2000000, 103);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 104);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = marketplace::settlement_v1)]
    fun v104_unowned_token_listing_fails() {
        let (_, seller, _, attacker) = setup();
        mint(&seller, b"one");
        settlement_v1::list(
            &attacker, @0xa, string::utf8(b"V1 Collection"), string::utf8(b"one"), 0, PRICE,
        );
    }

    #[test]
    #[expected_failure]
    fun v105_wrong_identity_fails() {
        let (_, seller, _, _) = setup();
        mint(&seller, b"one");
        list(&seller, b"two", 0);
    }

    #[test]
    fun v106_nonzero_property_version() {
        let (_, seller, buyer, _) = setup();
        mint_with(&seller, b"mutable", 1, 500, 10000, false, true);
        token::mutate_token_properties(
            &seller, @0xa, @0xa, string::utf8(b"V1 Collection"), string::utf8(b"mutable"),
            0, 1, vector[], vector[], vector[],
        );
        let versioned = token::create_token_id_raw(
            @0xa, string::utf8(b"V1 Collection"), string::utf8(b"mutable"), 1,
        );
        let id = list(&seller, b"mutable", 1);
        settlement_v1::buy(&buyer, id, PRICE, 0);
        assert!(token::balance_of(@0xb, versioned) == 1, 100);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = marketplace::settlement_v1)]
    fun v107_semi_fungible_rejected() {
        let (_, seller, _, _) = setup();
        mint_with(&seller, b"edition", 10, 500, 10000, false, false);
        list(&seller, b"edition", 0);
    }

    #[test]
    fun v108_exact_amount_is_one() {
        let (_, seller, _, _) = setup();
        mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        assert!(settlement_v1::escrow_amount(id) == 1, 100);
    }

    #[test]
    fun v109_exact_royalty_is_snapshotted() {
        let (_, seller, _, _) = setup();
        mint_with(&seller, b"royalty", 1, 750, 10000, false, false);
        let id = list(&seller, b"royalty", 0);
        let (_, _, _, _, _, payee, numerator, denominator, _) = marketplace::listing_terms(id);
        assert!(payee == @0xf && numerator == 750 && denominator == 10000, 100);
    }

    #[test]
    #[expected_failure(abort_code = 6, location = marketplace::settlement_v1)]
    fun v110_malformed_royalty_rejected() {
        let (_, seller, _, _) = setup();
        mint_with(&seller, b"malformed", 1, 0, 0, false, false);
        list(&seller, b"malformed", 0);
    }

    #[test]
    fun v111_mutable_royalty_uses_listing_snapshot() {
        let (_, seller, buyer, _) = setup();
        let token_id = mint_with(&seller, b"mutable royalty", 1, 500, 10000, true, false);
        let id = list(&seller, b"mutable royalty", 0);
        let (creator, collection_name, token_name, _) = token::get_token_id_fields(&token_id);
        token::mutate_tokendata_royalty(
            &seller,
            token::create_token_data_id(creator, collection_name, token_name),
            token::create_royalty(1000, 10000, @0xd),
        );
        settlement_v1::buy(&buyer, id, PRICE, 0);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 100);
        assert!(coin::balance<AptosCoin>(@0xd) == 0, 101);
    }

    #[test]
    fun v112_creator_royalty_payment() {
        let (_, seller, buyer, _) = setup();
        mint_with(&seller, b"royalty", 1, 750, 10000, false, false);
        settlement_v1::buy(&buyer, list(&seller, b"royalty", 0), PRICE, 0);
        assert!(coin::balance<AptosCoin>(@0xf) == 7500000, 100);
        assert!(coin::balance<AptosCoin>(@0xa) == 90500000, 101);
    }

    #[test]
    fun v113_cancel_does_not_require_direct_transfer_opt_in() {
        let (_, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        token::opt_in_direct_transfer(&seller, false);
        let id = list(&seller, b"one", 0);
        settlement_v1::cancel(&seller, id);
        assert!(token::balance_of(@0xa, token_id) == 1, 100);
    }

    #[test]
    fun v114_buy_initializes_buyer_token_store() {
        let (_, seller, buyer, _) = setup();
        let token_id = mint(&seller, b"one");
        assert!(!token::has_token_store(@0xb), 100);
        settlement_v1::buy(&buyer, list(&seller, b"one", 0), PRICE, 0);
        assert!(token::has_token_store(@0xb), 101);
        assert!(token::balance_of(@0xb, token_id) == 1, 102);
    }

    #[test]
    #[expected_failure]
    fun v115_property_mutation_cannot_touch_escrow() {
        let (_, seller, _, _) = setup();
        mint_with(&seller, b"mutable", 1, 500, 10000, false, true);
        list(&seller, b"mutable", 0);
        token::mutate_token_properties(
            &seller, @0xa, @0xa, string::utf8(b"V1 Collection"), string::utf8(b"mutable"),
            0, 1, vector[], vector[], vector[],
        );
    }

    #[test]
    fun v116_admin_has_no_escrow_seizure_path() {
        let (admin, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        assert!(signer::address_of(&admin) == @marketplace, 100);
        assert!(token::balance_of(@marketplace, token_id) == 0, 101);
        assert!(settlement_v1::has_escrow(id), 102);
    }

    #[test]
    fun v117_seller_cannot_double_spend_escrow() {
        let (_, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        list(&seller, b"one", 0);
        assert!(token::balance_of(@0xa, token_id) == 0, 100);
    }

    #[test]
    fun v118_unrelated_token_remains_untouched() {
        let (_, seller, _, _) = setup();
        mint(&seller, b"listed");
        let unrelated = mint(&seller, b"unrelated");
        list(&seller, b"listed", 0);
        assert!(token::balance_of(@0xa, unrelated) == 1, 100);
    }

    #[test]
    #[expected_failure]
    fun v119_preexisting_withdraw_capability_cannot_withdraw_escrow() {
        let (_, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        let capability = token::create_withdraw_capability(&seller, token_id, 1, 1000);
        list(&seller, b"one", 0);
        let unexpectedly_withdrawn = token::withdraw_with_capability(capability);
        token::deposit_token(&seller, unexpectedly_withdrawn);
    }

    #[test]
    fun v120_buyer_controls_token_after_settlement() {
        let (_, seller, buyer, _) = setup();
        let token_id = mint(&seller, b"one");
        settlement_v1::buy(&buyer, list(&seller, b"one", 0), PRICE, 0);
        let capability = token::create_withdraw_capability(&buyer, token_id, 1, 1000);
        let withdrawn = token::withdraw_with_capability(capability);
        assert!(token::get_token_amount(&withdrawn) == 1, 100);
        token::deposit_token(&buyer, withdrawn);
        assert!(token::balance_of(@0xb, token_id) == 1, 101);
    }

    #[test]
    fun audit_v1_cancel_paused_preserves_other_escrow_and_balances() {
        let (admin, seller, _, _) = setup();
        let first = mint(&seller, b"one");
        let second = mint(&seller, b"two");
        let a = list(&seller, b"one", 0);
        let b = list(&seller, b"two", 0);
        marketplace_fee_policy::set_global_paused(&admin, true);
        marketplace_fee_policy::set_v1_paused(&admin, true);
        let buyer_before = coin::balance<AptosCoin>(@0xb);
        settlement_v1::cancel(&seller, a);
        assert!(token::balance_of(@0xa, first) == 1, 100);
        assert!(token::balance_of(@0xa, second) == 0, 101);
        assert!(settlement_v1::has_escrow(b), 102);
        assert!(marketplace::listing_status(b) == 1, 103);
        assert!(coin::balance<AptosCoin>(@0xb) == buyer_before, 104);
        assert!(coin::balance<AptosCoin>(@0xa) == 0, 105);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = marketplace::settlement_v1)]
    fun audit_v1_cancel_then_buy_rejected() {
        let (_, seller, buyer, _) = setup();
        mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        settlement_v1::cancel(&seller, id);
        settlement_v1::buy(&buyer, id, PRICE, 0);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = marketplace::settlement_v1)]
    fun audit_v1_double_buy_rejected() {
        let (_, seller, buyer, _) = setup();
        mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        settlement_v1::buy(&buyer, id, PRICE, 0);
        settlement_v1::buy(&buyer, id, PRICE, 0);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = marketplace::settlement_v1)]
    fun audit_v1_buy_then_cancel_rejected() {
        let (_, seller, buyer, _) = setup();
        mint(&seller, b"one");
        let id = list(&seller, b"one", 0);
        settlement_v1::buy(&buyer, id, PRICE, 0);
        settlement_v1::cancel(&seller, id);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = marketplace::marketplace)]
    fun audit_v1_admin_cannot_cancel() {
        let (admin, seller, _, _) = setup();
        mint(&seller, b"one");
        settlement_v1::cancel(&admin, list(&seller, b"one", 0));
    }

    #[test]
    fun audit_v1_seller_capability_revives_after_cancel() {
        let (_, seller, _, _) = setup();
        let token_id = mint(&seller, b"one");
        let cap = token::create_withdraw_capability(&seller, token_id, 1, 1000);
        let id = list(&seller, b"one", 0);
        settlement_v1::cancel(&seller, id);
        let value = token::withdraw_with_capability(cap);
        assert!(token::get_token_amount(&value) == 1, 100);
        assert!(token::balance_of(@0xa, token_id) == 0, 101);
        token::deposit_token(&seller, value);
    }

    #[test]
    fun audit_v1_preexisting_buyer_capability_after_purchase() {
        let (_, seller, buyer, _) = setup();
        let token_id = mint(&seller, b"one");
        token::deposit_token(&buyer, token::withdraw_token(&seller, token_id, 1));
        let cap = token::create_withdraw_capability(&buyer, token_id, 1, 1000);
        token::deposit_token(&seller, token::withdraw_token(&buyer, token_id, 1));
        let id = list(&seller, b"one", 0);
        settlement_v1::buy(&buyer, id, PRICE, 0);
        let value = token::withdraw_with_capability(cap);
        assert!(token::get_token_amount(&value) == 1, 100);
        assert!(marketplace::listing_status(id) == 3, 101);
        token::deposit_token(&buyer, value);
    }
}
