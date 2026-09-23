#[test_only]
module launchpad::fee_policy_tests {
    use launchpad::fee_policy;

    #[test(package = @launchpad)]
    fun initializes_fee_and_recipient(package: &signer) {
        fee_policy::initialize(package, @0xa);
        let (bps, recipient, paused, admin) = fee_policy::configuration();
        assert!(bps == 500 && recipient == @0xa && !paused && admin == @launchpad, 100);
    }

    #[test]
    fun fee_split_conserves_revenue() {
        let (total, fee, creator) = fee_policy::quote(100000000, 2, 500);
        assert!(total == 200000000 && fee == 10000000 && creator == 190000000, 100);
        assert!(fee + creator == total, 101);
    }

    #[test]
    fun fee_rounding_is_batch_invariant() {
        let (_, single_fee, _) = fee_policy::quote(999, 1, 500);
        let (total, batch_fee, creator) = fee_policy::quote(999, 10, 500);
        assert!(batch_fee == single_fee * 10 && batch_fee == 490, 100);
        assert!(total == batch_fee + creator, 101);
    }

    #[test]
    fun zero_price_and_zero_fee() {
        let (total, fee, revenue) = fee_policy::quote(0, 10, 500);
        assert!(total == 0 && fee == 0 && revenue == 0, 100);
        let (total, fee, revenue) = fee_policy::quote(1000, 10, 0);
        assert!(total == 10000 && fee == 0 && revenue == 10000, 101);
    }

    #[test]
    fun full_u64_range_uses_wide_intermediate() {
        let (total, fee, revenue) = fee_policy::quote(18446744073709551615, 1, 1000);
        assert!(total == 18446744073709551615, 100);
        assert!(fee == 1844674407370955161 && fee + revenue == total, 101);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = launchpad::fee_policy)]
    fun total_overflow_rejected() { fee_policy::quote(18446744073709551615, 2, 500); }

    #[test]
    #[expected_failure(abort_code = 4, location = launchpad::fee_policy)]
    fun zero_quantity_rejected() { fee_policy::quote(1, 0, 500); }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::fee_policy)]
    fun quote_fee_cap() { fee_policy::quote(100, 1, 1001); }

    #[test(package = @launchpad)]
    fun admin_can_update_fee_recipient_and_pause(package: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::set_fee(package, 1000);
        fee_policy::set_recipient(package, @0xb);
        fee_policy::set_paused(package, true);
        let (bps, recipient, paused, _) = fee_policy::configuration();
        assert!(bps == 1000 && recipient == @0xb && paused, 100);
        fee_policy::set_paused(package, false);
        let (_, _, paused, _) = fee_policy::configuration();
        assert!(!paused, 101);
    }

    #[test(package = @launchpad, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = launchpad::fee_policy)]
    fun unauthorized_fee_update(package: &signer, attacker: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::set_fee(attacker, 0);
    }

    #[test(package = @launchpad, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = launchpad::fee_policy)]
    fun unauthorized_recipient_update(package: &signer, attacker: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::set_recipient(attacker, @0xb);
    }

    #[test(package = @launchpad, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = launchpad::fee_policy)]
    fun unauthorized_pause(package: &signer, attacker: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::set_paused(attacker, true);
    }

    #[test(package = @launchpad)]
    #[expected_failure(abort_code = 2, location = launchpad::fee_policy)]
    fun admin_cannot_exceed_fee_cap(package: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::set_fee(package, 1001);
    }

    #[test(package = @launchpad)]
    #[expected_failure(abort_code = 3, location = launchpad::fee_policy)]
    fun zero_recipient_rejected(package: &signer) { fee_policy::initialize(package, @0x0); }

    #[test(package = @launchpad)]
    #[expected_failure(abort_code = 3, location = launchpad::fee_policy)]
    fun zero_recipient_update_rejected(package: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::set_recipient(package, @0x0);
    }

    #[test(attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = launchpad::fee_policy)]
    fun unauthorized_initialization(attacker: &signer) { fee_policy::initialize(attacker, @0xb); }

    #[test(package = @launchpad)]
    #[expected_failure(abort_code = 8, location = launchpad::fee_policy)]
    fun cannot_reinitialize(package: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::initialize(package, @0xb);
    }

    #[test(package = @launchpad, next_admin = @0xb)]
    fun admin_transfer_requires_acceptance(package: &signer, next_admin: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::propose_admin(package, @0xb);
        let (_, _, _, admin) = fee_policy::configuration();
        assert!(admin == @launchpad, 100);
        fee_policy::accept_admin(next_admin);
        fee_policy::set_fee(next_admin, 500);
        let (bps, _, _, admin) = fee_policy::configuration();
        assert!(admin == @0xb && bps == 500, 101);
    }

    #[test(package = @launchpad, attacker = @0xc)]
    #[expected_failure(abort_code = 6, location = launchpad::fee_policy)]
    fun wrong_account_cannot_accept(package: &signer, attacker: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::propose_admin(package, @0xb);
        fee_policy::accept_admin(attacker);
    }

    #[test(package = @launchpad, next_admin = @0xb)]
    #[expected_failure(abort_code = 1, location = launchpad::fee_policy)]
    fun old_admin_loses_authority(package: &signer, next_admin: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::propose_admin(package, @0xb);
        fee_policy::accept_admin(next_admin);
        fee_policy::set_fee(package, 100);
    }

    #[test(package = @launchpad)]
    #[expected_failure(abort_code = 3, location = launchpad::fee_policy)]
    fun zero_nominee_rejected(package: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::propose_admin(package, @0x0);
    }

    #[test(package = @launchpad, attacker = @0xb)]
    #[expected_failure(abort_code = 1, location = launchpad::fee_policy)]
    fun unauthorized_admin_proposal(package: &signer, attacker: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::propose_admin(attacker, @0xb);
    }

    #[test(package = @launchpad, attacker = @0xb)]
    #[expected_failure(abort_code = 6, location = launchpad::fee_policy)]
    fun acceptance_without_nomination_rejected(package: &signer, attacker: &signer) {
        fee_policy::initialize(package, @0xa);
        fee_policy::accept_admin(attacker);
    }
}
