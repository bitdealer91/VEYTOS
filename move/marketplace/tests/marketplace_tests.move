#[test_only]
module marketplace::marketplace_tests {
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use marketplace::marketplace_fee_policy;
    use marketplace::marketplace;

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
        aptos_account::deposit_fungible_assets(@0xb, aptos_coin::mint_apt_fa_for_test(100000000000));
        (admin, seller, buyer, attacker)
    }

    fun identity(seed: u64): marketplace::AssetIdentity {
        marketplace::new_v1_identity_for_test(@0xe, seed, 0)
    }

    fun list(seller: &signer, seed: u64): u64 {
        marketplace::create_listing(
            signer::address_of(seller), identity(seed), PRICE, @0xf, 500, 10000,
        )
    }

    #[test]
    fun g01_create_listing() {
        let (_, seller, _, _) = setup();
        let id = list(&seller, 1);
        let (recorded_seller, standard, price, fee_bps, _, numerator, denominator, status) =
            marketplace::listing_terms(id);
        assert!(id == 1 && recorded_seller == @0xa && standard == 1, 100);
        assert!(price == PRICE && fee_bps == 200, 101);
        assert!(numerator == 500 && denominator == 10000 && status == 1, 102);
    }

    #[test]
    fun g02_monotonic_ids() {
        let (_, seller, _, _) = setup();
        assert!(list(&seller, 1) == 1, 100);
        marketplace::cancel_listing(@0xa, 1, 1);
        assert!(list(&seller, 2) == 2, 101);
    }

    #[test]
    #[expected_failure(abort_code = 6, location = marketplace::marketplace)]
    fun g03_asset_key_uniqueness() {
        let (_, seller, _, _) = setup();
        list(&seller, 1);
        list(&seller, 1);
    }

    #[test]
    fun g04_cross_standard_key_separation() {
        let (_, seller, _, _) = setup();
        let v1 = list(&seller, 1);
        marketplace::set_v2_reviewed_for_test(@0xe, 1);
        let v2 = marketplace::create_listing(
            @0xa, marketplace::new_v2_identity_for_test(@0xe, @0xe), PRICE, @0xf, 500, 10000,
        );
        assert!(v1 == 1 && v2 == 2, 100);
    }

    #[test]
    fun g05_cancel_listing() {
        let (_, seller, _, _) = setup();
        let id = list(&seller, 1);
        marketplace::cancel_listing(@0xa, id, 1);
        assert!(marketplace::listing_status(id) == 2, 100);
        assert!(!marketplace::is_active_asset(identity(1)), 101);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = marketplace::marketplace)]
    fun g06_unauthorized_cancel() {
        let (_, seller, _, _) = setup();
        let id = list(&seller, 1);
        marketplace::cancel_listing(@0xd, id, 1);
    }

    #[test]
    fun g07_buy_listing() {
        let (_, seller, buyer, _) = setup();
        let id = list(&seller, 1);
        marketplace::buy_listing(&buyer, id, PRICE, 1);
        assert!(marketplace::listing_status(id) == 3, 100);
        assert!(coin::balance<AptosCoin>(@0xa) == 93000000, 101);
        assert!(coin::balance<AptosCoin>(@0xc) == 2000000, 102);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 103);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = marketplace::marketplace)]
    fun g08_seller_buys_own_listing() {
        let (_, seller, _, _) = setup();
        aptos_account::deposit_fungible_assets(@0xa, aptos_coin::mint_apt_fa_for_test(PRICE));
        let id = list(&seller, 1);
        marketplace::buy_listing(&seller, id, PRICE, 1);
    }

    #[test]
    #[expected_failure(abort_code = 3, location = marketplace::marketplace)]
    fun g09_nonexistent_listing() {
        let (_, _, _, _) = setup();
        marketplace::cancel_listing(@0xa, 404, 1);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = marketplace::marketplace)]
    fun g10_cancelled_replay() {
        let (_, seller, _, _) = setup();
        let id = list(&seller, 1);
        marketplace::cancel_listing(@0xa, id, 1);
        marketplace::cancel_listing(@0xa, id, 1);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = marketplace::marketplace)]
    fun g11_sold_replay() {
        let (_, seller, buyer, _) = setup();
        let id = list(&seller, 1);
        marketplace::buy_listing(&buyer, id, PRICE, 1);
        marketplace::buy_listing(&buyer, id, PRICE, 1);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = marketplace::marketplace)]
    fun g12_wrong_expected_price() {
        let (_, seller, buyer, _) = setup();
        let id = list(&seller, 1);
        marketplace::buy_listing(&buyer, id, PRICE - 1, 1);
    }

    #[test]
    fun g13_immutable_price() {
        let (_, seller, _, _) = setup();
        let old = list(&seller, 1);
        marketplace::cancel_listing(@0xa, old, 1);
        let new = marketplace::create_listing(@0xa, identity(1), PRICE + 1, @0xf, 500, 10000);
        assert!(old != new, 100);
        assert!(marketplace::listing_price(old) == PRICE, 101);
        assert!(marketplace::listing_price(new) == PRICE + 1, 102);
    }

    #[test]
    fun g14_fee_snapshot() {
        let (admin, seller, buyer, _) = setup();
        let old = list(&seller, 1);
        marketplace_fee_policy::set_fee(&admin, 300);
        let new = list(&seller, 2);
        assert!(marketplace::listing_fee_bps(old) == 200, 100);
        assert!(marketplace::listing_fee_bps(new) == 300, 101);
        marketplace::buy_listing(&buyer, old, PRICE, 1);
        assert!(coin::balance<AptosCoin>(@0xc) == 2000000, 102);
    }

    #[test]
    fun g15_recipient_rotation() {
        let (admin, seller, buyer, _) = setup();
        let id = list(&seller, 1);
        marketplace_fee_policy::set_recipient(&admin, @0xd);
        marketplace::buy_listing(&buyer, id, PRICE, 1);
        assert!(coin::balance<AptosCoin>(@0xc) == 0, 100);
        assert!(coin::balance<AptosCoin>(@0xd) == 2000000, 101);
    }

    #[test]
    fun g16_royalty_snapshot() {
        let (_, seller, buyer, _) = setup();
        let id = list(&seller, 1);
        let (_, _, _, _, payee, numerator, denominator, _) = marketplace::listing_terms(id);
        assert!(payee == @0xf && numerator == 500 && denominator == 10000, 100);
        marketplace::buy_listing(&buyer, id, PRICE, 1);
        assert!(coin::balance<AptosCoin>(@0xf) == 5000000, 101);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun g17_global_pause() {
        let (admin, seller, buyer, _) = setup();
        let id = list(&seller, 1);
        marketplace_fee_policy::set_global_paused(&admin, true);
        marketplace::buy_listing(&buyer, id, PRICE, 1);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun g18_v1_adapter_pause() {
        let (admin, seller, _, _) = setup();
        marketplace_fee_policy::set_v1_paused(&admin, true);
        list(&seller, 1);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun g19_v2_adapter_pause() {
        let (admin, _, _, _) = setup();
        marketplace::set_v2_reviewed_for_test(@0xe, 1);
        marketplace_fee_policy::set_v2_paused(&admin, true);
        marketplace::create_listing(
            @0xa, marketplace::new_v2_identity_for_test(@0xe, @0xe), PRICE, @0xf, 500, 10000,
        );
    }

    #[test]
    fun g20_cancellation_during_pause() {
        let (admin, seller, _, _) = setup();
        let id = list(&seller, 1);
        marketplace_fee_policy::set_global_paused(&admin, true);
        marketplace_fee_policy::set_v1_paused(&admin, true);
        marketplace::cancel_listing(@0xa, id, 1);
        assert!(marketplace::listing_status(id) == 2, 100);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun g21_pause_authorization() {
        let (_, _, _, attacker) = setup();
        marketplace_fee_policy::set_global_paused(&attacker, true);
    }

    #[test]
    fun g22_event_consistency() {
        let (_, seller, buyer, _) = setup();
        let cancelled = list(&seller, 1);
        marketplace::cancel_listing(@0xa, cancelled, 1);
        let sold = list(&seller, 2);
        marketplace::buy_listing(&buyer, sold, PRICE, 1);
        marketplace::assert_events_for_test(cancelled, sold, @0xa, @0xb, PRICE, 2000000, 5000000, 93000000);
    }
}
