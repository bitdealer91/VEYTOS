#[test_only]
module marketplace::marketplace_fee_policy_tests {
    use std::option;
    use marketplace::marketplace_fee_policy;

    #[test(publisher = @marketplace)]
    fun f01_initialize_defaults(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        let (fee_bps, recipient, global_paused, v1_paused, v2_paused, admin) =
            marketplace_fee_policy::configuration();
        assert!(fee_bps == 200, 100);
        assert!(recipient == @0xa, 101);
        assert!(!global_paused && !v1_paused && !v2_paused, 102);
        assert!(admin == @marketplace, 103);
        assert!(option::is_none(&marketplace_fee_policy::pending_admin()), 104);
    }

    #[test(attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun f02_initialization_authorization(attacker: &signer) {
        marketplace_fee_policy::initialize(attacker, @0xa);
    }

    #[test(publisher = @marketplace)]
    #[expected_failure(abort_code = 8, location = marketplace::marketplace_fee_policy)]
    fun f03_reinitialization(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::initialize(publisher, @0xb);
    }

    #[test(publisher = @marketplace)]
    fun f04_fee_update(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_fee(publisher, 250);
        assert!(marketplace_fee_policy::fee_bps() == 250, 100);
    }

    #[test(publisher = @marketplace)]
    #[expected_failure(abort_code = 2, location = marketplace::marketplace_fee_policy)]
    fun f05_fee_cap(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_fee(publisher, 501);
    }

    #[test(publisher = @marketplace, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun f06_fee_authorization(publisher: &signer, attacker: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_fee(attacker, 100);
    }

    #[test(publisher = @marketplace)]
    fun f07_recipient_update(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_recipient(publisher, @0xb);
        assert!(marketplace_fee_policy::recipient() == @0xb, 100);
    }

    #[test(publisher = @marketplace)]
    #[expected_failure(abort_code = 3, location = marketplace::marketplace_fee_policy)]
    fun f08_invalid_recipient(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0x0);
    }

    #[test(publisher = @marketplace, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun f09_recipient_authorization(publisher: &signer, attacker: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_recipient(attacker, @0xb);
    }

    #[test(publisher = @marketplace, next_admin = @0xb)]
    fun f10_two_step_admin_transfer(publisher: &signer, next_admin: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::propose_admin(publisher, @0xb);
        assert!(marketplace_fee_policy::admin() == @marketplace, 100);
        marketplace_fee_policy::accept_admin(next_admin);
        assert!(marketplace_fee_policy::admin() == @0xb, 101);
        marketplace_fee_policy::set_fee(next_admin, 300);
    }

    #[test(publisher = @marketplace, attacker = @0xc)]
    #[expected_failure(abort_code = 6, location = marketplace::marketplace_fee_policy)]
    fun f11_wrong_admin_acceptance(publisher: &signer, attacker: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::propose_admin(publisher, @0xb);
        marketplace_fee_policy::accept_admin(attacker);
    }

    #[test]
    fun f12_two_percent_exact_quote() {
        let (fee, royalty, seller) = marketplace_fee_policy::quote_sale(10000000000, 200, 0, 1);
        assert!(fee == 200000000, 100);
        assert!(royalty == 0, 101);
        assert!(seller == 9800000000, 102);
    }

    #[test]
    fun f13_fee_rounding() {
        let (fee, royalty, seller) = marketplace_fee_policy::quote_sale(99, 200, 0, 1);
        assert!(fee == 1 && royalty == 0 && seller == 98, 100);
        let (fee, _, seller) = marketplace_fee_policy::quote_sale(100, 200, 0, 1);
        assert!(fee == 2 && seller == 98, 101);
    }

    #[test]
    fun f14_royalty_rounding() {
        let (fee, royalty, seller) = marketplace_fee_policy::quote_sale(100, 200, 1, 3);
        assert!(fee == 2 && royalty == 33 && seller == 65, 100);
    }

    #[test]
    fun f15_combined_conservation() {
        let gross = 123456789;
        let (fee, royalty, seller) = marketplace_fee_policy::quote_sale(gross, 200, 55, 1000);
        assert!(gross == fee + royalty + seller, 100);
    }

    #[test]
    #[expected_failure(abort_code = 10, location = marketplace::marketplace_fee_policy)]
    fun f16_excessive_deductions() {
        marketplace_fee_policy::quote_sale(1, 500, 1, 1);
    }

    #[test]
    fun f17_u64_boundary() {
        let gross = 18446744073709551615;
        let (fee, royalty, seller) = marketplace_fee_policy::quote_sale(gross, 200, 1, 100);
        assert!(gross == fee + royalty + seller, 100);
    }

    #[test]
    #[expected_failure(abort_code = 9, location = marketplace::marketplace_fee_policy)]
    fun f18_zero_price_policy() {
        marketplace_fee_policy::quote_sale(0, 200, 0, 1);
    }

    #[test(publisher = @marketplace)]
    fun f19_storage_reimbursement_defaults_and_update(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        assert!(marketplace_fee_policy::storage_reimbursement(1) == 0, 100);
        assert!(marketplace_fee_policy::storage_reimbursement(2) == 926400, 101);
        marketplace_fee_policy::set_v1_storage_reimbursement(publisher, 500000);
        marketplace_fee_policy::set_v2_storage_reimbursement(publisher, 900000);
        assert!(marketplace_fee_policy::storage_reimbursement(1) == 500000, 102);
        assert!(marketplace_fee_policy::storage_reimbursement(2) == 900000, 103);
    }

    #[test(publisher = @marketplace, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = marketplace::marketplace_fee_policy)]
    fun f20_storage_reimbursement_authorization(publisher: &signer, attacker: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_v2_storage_reimbursement(attacker, 1);
    }

    #[test(publisher = @marketplace)]
    #[expected_failure(abort_code = 12, location = marketplace::marketplace_fee_policy)]
    fun f21_storage_reimbursement_cap(publisher: &signer) {
        marketplace_fee_policy::initialize(publisher, @0xa);
        marketplace_fee_policy::set_v2_storage_reimbursement(publisher, 10000001);
    }
}
