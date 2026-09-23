/// Primary fee administration. The launchpad snapshots the rate at preparation.
/// This module does not hold or transfer funds.
module launchpad::fee_policy {
    use std::signer;
    use std::option::{Self, Option};
    use aptos_framework::event;

    const EUNAUTHORIZED: u64 = 1;
    const EFEE_TOO_HIGH: u64 = 2;
    const EZERO_ADDRESS: u64 = 3;
    const EZERO_QUANTITY: u64 = 4;
    const EAMOUNT_OVERFLOW: u64 = 5;
    const ENOT_PENDING_ADMIN: u64 = 6;
    const ENOT_INITIALIZED: u64 = 7;
    const EALREADY_INITIALIZED: u64 = 8;
    const MAX_FEE_BPS: u64 = 1000;
    const INITIAL_FEE_BPS: u64 = 500;
    const BPS_DENOMINATOR: u128 = 10000;
    const MAX_U64: u128 = 18446744073709551615;

    struct Config has key {
        admin: address,
        pending_admin: Option<address>,
        fee_bps: u64,
        recipient: address,
        paused: bool,
    }

    #[event]
    struct PlatformInitialized has drop, store {
        admin: address, recipient: address, fee_bps: u64,
    }
    #[event]
    struct PlatformFeeUpdated has drop, store { old_bps: u64, new_bps: u64 }
    #[event]
    struct FeeRecipientUpdated has drop, store { old_recipient: address, new_recipient: address }
    #[event]
    struct PlatformPauseUpdated has drop, store { paused: bool }
    #[event]
    struct AdminTransferProposed has drop, store { current_admin: address, proposed_admin: address }
    #[event]
    struct AdminTransferAccepted has drop, store { old_admin: address, new_admin: address }

    public entry fun initialize(publisher: &signer, recipient: address) {
        assert!(signer::address_of(publisher) == @launchpad, EUNAUTHORIZED);
        assert!(!exists<Config>(@launchpad), EALREADY_INITIALIZED);
        assert!(recipient != @0x0, EZERO_ADDRESS);
        move_to(publisher, Config {
            admin: @launchpad,
            pending_admin: option::none(),
            fee_bps: INITIAL_FEE_BPS,
            recipient,
            paused: false,
        });
        event::emit(PlatformInitialized { admin: @launchpad, recipient, fee_bps: INITIAL_FEE_BPS });
    }

    fun assert_admin(caller: &signer) acquires Config {
        assert!(exists<Config>(@launchpad), ENOT_INITIALIZED);
        assert!(signer::address_of(caller) == borrow_global<Config>(@launchpad).admin, EUNAUTHORIZED);
    }

    public entry fun set_fee(caller: &signer, new_bps: u64) acquires Config {
        assert_admin(caller);
        assert!(new_bps <= MAX_FEE_BPS, EFEE_TOO_HIGH);
        let config = borrow_global_mut<Config>(@launchpad);
        let old_bps = config.fee_bps;
        config.fee_bps = new_bps;
        event::emit(PlatformFeeUpdated { old_bps, new_bps });
    }

    public entry fun set_recipient(caller: &signer, new_recipient: address) acquires Config {
        assert_admin(caller);
        assert!(new_recipient != @0x0, EZERO_ADDRESS);
        let config = borrow_global_mut<Config>(@launchpad);
        let old_recipient = config.recipient;
        config.recipient = new_recipient;
        event::emit(FeeRecipientUpdated { old_recipient, new_recipient });
    }

    public entry fun set_paused(caller: &signer, paused: bool) acquires Config {
        assert_admin(caller);
        borrow_global_mut<Config>(@launchpad).paused = paused;
        event::emit(PlatformPauseUpdated { paused });
    }

    public entry fun propose_admin(caller: &signer, proposed_admin: address) acquires Config {
        assert_admin(caller);
        assert!(proposed_admin != @0x0, EZERO_ADDRESS);
        let config = borrow_global_mut<Config>(@launchpad);
        config.pending_admin = option::some(proposed_admin);
        event::emit(AdminTransferProposed { current_admin: config.admin, proposed_admin });
    }

    public entry fun accept_admin(caller: &signer) acquires Config {
        assert!(exists<Config>(@launchpad), ENOT_INITIALIZED);
        let config = borrow_global_mut<Config>(@launchpad);
        let new_admin = signer::address_of(caller);
        assert!(option::is_some(&config.pending_admin), ENOT_PENDING_ADMIN);
        assert!(*option::borrow(&config.pending_admin) == new_admin, ENOT_PENDING_ADMIN);
        let old_admin = config.admin;
        config.admin = new_admin;
        config.pending_admin = option::none();
        event::emit(AdminTransferAccepted { old_admin, new_admin });
    }

    #[view]
    public fun configuration(): (u64, address, bool, address) acquires Config {
        assert!(exists<Config>(@launchpad), ENOT_INITIALIZED);
        let config = borrow_global<Config>(@launchpad);
        (config.fee_bps, config.recipient, config.paused, config.admin)
    }

    #[view]
    public fun pending_admin(): Option<address> acquires Config {
        assert!(exists<Config>(@launchpad), ENOT_INITIALIZED);
        borrow_global<Config>(@launchpad).pending_admin
    }

    #[view]
    /// Stateless quote. The eventual mint entry point must supply the drop's
    /// immutable fee snapshot, never a buyer-selected rate.
    public fun quote(unit_price: u64, quantity: u64, fee_bps: u64): (u64, u64, u64) {
        assert!(quantity > 0, EZERO_QUANTITY);
        assert!(fee_bps <= MAX_FEE_BPS, EFEE_TOO_HIGH);
        let total = (unit_price as u128) * (quantity as u128);
        assert!(total <= MAX_U64, EAMOUNT_OVERFLOW);
        let fee_per_token = (unit_price as u128) * (fee_bps as u128) / BPS_DENOMINATOR;
        let fee = fee_per_token * (quantity as u128);
        (total as u64, fee as u64, (total - fee) as u64)
    }

    #[test(publisher = @launchpad)]
    fun configuration_events(publisher: &signer) acquires Config {
        initialize(publisher, @0xa);
        set_fee(publisher, 600);
        set_recipient(publisher, @0xb);
        set_paused(publisher, true);
        assert!(event::was_event_emitted(&PlatformInitialized { admin: @launchpad, recipient: @0xa, fee_bps: 500 }), 100);
        assert!(event::was_event_emitted(&PlatformFeeUpdated { old_bps: 500, new_bps: 600 }), 101);
        assert!(event::was_event_emitted(&FeeRecipientUpdated { old_recipient: @0xa, new_recipient: @0xb }), 102);
        assert!(event::was_event_emitted(&PlatformPauseUpdated { paused: true }), 103);
    }
}
