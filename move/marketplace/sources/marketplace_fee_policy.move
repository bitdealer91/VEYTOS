/// Independent secondary-market economics and administration.
/// This module never stores NFTs or holds arbitrary user funds.
module marketplace::marketplace_fee_policy {
    use std::option::{Self, Option};
    use std::signer;
    use aptos_framework::event;

    const EUNAUTHORIZED: u64 = 1;
    const EFEE_TOO_HIGH: u64 = 2;
    const EZERO_ADDRESS: u64 = 3;
    const EINVALID_ROYALTY: u64 = 4;
    const ENOT_INITIALIZED: u64 = 5;
    const ENOT_PENDING_ADMIN: u64 = 6;
    const EZERO_NOMINEE: u64 = 7;
    const EALREADY_INITIALIZED: u64 = 8;
    const EZERO_PRICE: u64 = 9;
    const EINVALID_DEDUCTIONS: u64 = 10;
    const EPAUSED: u64 = 11;
    const ESTORAGE_REIMBURSEMENT_TOO_HIGH: u64 = 12;

    const INITIAL_FEE_BPS: u64 = 200;
    const MAX_FEE_BPS: u64 = 500;
    const INITIAL_V1_STORAGE_REIMBURSEMENT_OCTAS: u64 = 0;
    const INITIAL_V2_STORAGE_REIMBURSEMENT_OCTAS: u64 = 926400;
    const MAX_STORAGE_REIMBURSEMENT_OCTAS: u64 = 10000000;
    const BPS_DENOMINATOR: u128 = 10000;

    const PAUSE_GLOBAL: u8 = 0;
    const PAUSE_V1: u8 = 1;
    const PAUSE_V2: u8 = 2;

    struct Config has key {
        admin: address,
        pending_admin: Option<address>,
        fee_bps: u64,
        recipient: address,
        v1_storage_reimbursement_octas: u64,
        v2_storage_reimbursement_octas: u64,
        global_paused: bool,
        v1_paused: bool,
        v2_paused: bool,
    }

    #[event]
    struct MarketplaceInitialized has drop, store {
        admin: address,
        recipient: address,
        fee_bps: u64,
    }

    #[event]
    struct MarketplaceFeeUpdated has drop, store {
        old_bps: u64,
        new_bps: u64,
    }

    #[event]
    struct MarketplaceFeeRecipientUpdated has drop, store {
        old_recipient: address,
        new_recipient: address,
    }

    #[event]
    struct MarketplaceStorageReimbursementUpdated has drop, store {
        standard: u8,
        old_octas: u64,
        new_octas: u64,
    }

    #[event]
    struct MarketplacePauseUpdated has drop, store {
        scope: u8,
        paused: bool,
    }

    #[event]
    struct MarketplaceAdminTransferProposed has drop, store {
        current_admin: address,
        proposed_admin: address,
    }

    #[event]
    struct MarketplaceAdminTransferAccepted has drop, store {
        old_admin: address,
        new_admin: address,
    }

    public entry fun initialize(publisher: &signer, recipient: address) {
        assert!(signer::address_of(publisher) == @marketplace, EUNAUTHORIZED);
        assert!(!exists<Config>(@marketplace), EALREADY_INITIALIZED);
        assert!(recipient != @0x0, EZERO_ADDRESS);
        move_to(publisher, Config {
            admin: @marketplace,
            pending_admin: option::none(),
            fee_bps: INITIAL_FEE_BPS,
            recipient,
            v1_storage_reimbursement_octas: INITIAL_V1_STORAGE_REIMBURSEMENT_OCTAS,
            v2_storage_reimbursement_octas: INITIAL_V2_STORAGE_REIMBURSEMENT_OCTAS,
            global_paused: false,
            v1_paused: false,
            v2_paused: false,
        });
        event::emit(MarketplaceInitialized {
            admin: @marketplace,
            recipient,
            fee_bps: INITIAL_FEE_BPS,
        });
    }

    fun assert_admin(caller: &signer) acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        assert!(signer::address_of(caller) == borrow_global<Config>(@marketplace).admin, EUNAUTHORIZED);
    }

    public entry fun set_fee(caller: &signer, new_bps: u64) acquires Config {
        assert_admin(caller);
        assert!(new_bps <= MAX_FEE_BPS, EFEE_TOO_HIGH);
        let config = borrow_global_mut<Config>(@marketplace);
        let old_bps = config.fee_bps;
        config.fee_bps = new_bps;
        event::emit(MarketplaceFeeUpdated { old_bps, new_bps });
    }

    public entry fun set_recipient(caller: &signer, new_recipient: address) acquires Config {
        assert_admin(caller);
        assert!(new_recipient != @0x0, EZERO_ADDRESS);
        let config = borrow_global_mut<Config>(@marketplace);
        let old_recipient = config.recipient;
        config.recipient = new_recipient;
        event::emit(MarketplaceFeeRecipientUpdated { old_recipient, new_recipient });
    }

    public entry fun set_v1_storage_reimbursement(caller: &signer, new_octas: u64) acquires Config {
        assert_admin(caller);
        assert!(new_octas <= MAX_STORAGE_REIMBURSEMENT_OCTAS, ESTORAGE_REIMBURSEMENT_TOO_HIGH);
        let config = borrow_global_mut<Config>(@marketplace);
        let old_octas = config.v1_storage_reimbursement_octas;
        config.v1_storage_reimbursement_octas = new_octas;
        event::emit(MarketplaceStorageReimbursementUpdated {
            standard: 1,
            old_octas,
            new_octas,
        });
    }

    public entry fun set_v2_storage_reimbursement(caller: &signer, new_octas: u64) acquires Config {
        assert_admin(caller);
        assert!(new_octas <= MAX_STORAGE_REIMBURSEMENT_OCTAS, ESTORAGE_REIMBURSEMENT_TOO_HIGH);
        let config = borrow_global_mut<Config>(@marketplace);
        let old_octas = config.v2_storage_reimbursement_octas;
        config.v2_storage_reimbursement_octas = new_octas;
        event::emit(MarketplaceStorageReimbursementUpdated {
            standard: 2,
            old_octas,
            new_octas,
        });
    }

    public entry fun set_global_paused(caller: &signer, paused: bool) acquires Config {
        assert_admin(caller);
        borrow_global_mut<Config>(@marketplace).global_paused = paused;
        event::emit(MarketplacePauseUpdated { scope: PAUSE_GLOBAL, paused });
    }

    public entry fun set_v1_paused(caller: &signer, paused: bool) acquires Config {
        assert_admin(caller);
        borrow_global_mut<Config>(@marketplace).v1_paused = paused;
        event::emit(MarketplacePauseUpdated { scope: PAUSE_V1, paused });
    }

    public entry fun set_v2_paused(caller: &signer, paused: bool) acquires Config {
        assert_admin(caller);
        borrow_global_mut<Config>(@marketplace).v2_paused = paused;
        event::emit(MarketplacePauseUpdated { scope: PAUSE_V2, paused });
    }

    public entry fun propose_admin(caller: &signer, proposed_admin: address) acquires Config {
        assert_admin(caller);
        assert!(proposed_admin != @0x0, EZERO_NOMINEE);
        let config = borrow_global_mut<Config>(@marketplace);
        config.pending_admin = option::some(proposed_admin);
        event::emit(MarketplaceAdminTransferProposed {
            current_admin: config.admin,
            proposed_admin,
        });
    }

    public entry fun accept_admin(caller: &signer) acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        let config = borrow_global_mut<Config>(@marketplace);
        let new_admin = signer::address_of(caller);
        assert!(option::is_some(&config.pending_admin), ENOT_PENDING_ADMIN);
        assert!(*option::borrow(&config.pending_admin) == new_admin, ENOT_PENDING_ADMIN);
        let old_admin = config.admin;
        config.admin = new_admin;
        config.pending_admin = option::none();
        event::emit(MarketplaceAdminTransferAccepted { old_admin, new_admin });
    }

    #[view]
    public fun configuration(): (u64, address, bool, bool, bool, address) acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        let config = borrow_global<Config>(@marketplace);
        (
            config.fee_bps,
            config.recipient,
            config.global_paused,
            config.v1_paused,
            config.v2_paused,
            config.admin,
        )
    }

    #[view]
    public fun fee_bps(): u64 acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        borrow_global<Config>(@marketplace).fee_bps
    }

    #[view]
    public fun recipient(): address acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        borrow_global<Config>(@marketplace).recipient
    }

    #[view]
    public fun storage_reimbursement(standard: u8): u64 acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        let config = borrow_global<Config>(@marketplace);
        if (standard == 1) {
            config.v1_storage_reimbursement_octas
        } else {
            assert!(standard == 2, EINVALID_DEDUCTIONS);
            config.v2_storage_reimbursement_octas
        }
    }

    #[view]
    public fun admin(): address acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        borrow_global<Config>(@marketplace).admin
    }

    #[view]
    public fun pending_admin(): Option<address> acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        borrow_global<Config>(@marketplace).pending_admin
    }

    public(package) fun assert_v1_open() acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        let config = borrow_global<Config>(@marketplace);
        assert!(!config.global_paused && !config.v1_paused, EPAUSED);
    }

    public(package) fun assert_v2_open() acquires Config {
        assert!(exists<Config>(@marketplace), ENOT_INITIALIZED);
        let config = borrow_global<Config>(@marketplace);
        assert!(!config.global_paused && !config.v2_paused, EPAUSED);
    }

    /// Quotes deductions from an immutable gross sale price. The royalty fraction
    /// is retained exactly rather than being reduced to bps.
    public fun quote_sale(
        gross: u64,
        fee_bps: u64,
        royalty_numerator: u64,
        royalty_denominator: u64,
    ): (u64, u64, u64) {
        assert!(gross > 0, EZERO_PRICE);
        assert!(fee_bps <= MAX_FEE_BPS, EFEE_TOO_HIGH);
        assert!(royalty_denominator > 0, EINVALID_ROYALTY);
        assert!(royalty_numerator <= royalty_denominator, EINVALID_ROYALTY);
        let gross_128 = gross as u128;
        let fee = gross_128 * (fee_bps as u128) / BPS_DENOMINATOR;
        let royalty = gross_128 * (royalty_numerator as u128) / (royalty_denominator as u128);
        assert!(fee + royalty < gross_128, EINVALID_DEDUCTIONS);
        let seller = gross_128 - fee - royalty;
        (fee as u64, royalty as u64, seller as u64)
    }

    #[test(publisher = @marketplace)]
    fun configuration_events(publisher: &signer) acquires Config {
        initialize(publisher, @0xa);
        set_fee(publisher, 250);
        set_recipient(publisher, @0xb);
        set_global_paused(publisher, true);
        assert!(event::was_event_emitted(&MarketplaceInitialized {
            admin: @marketplace,
            recipient: @0xa,
            fee_bps: 200,
        }), 100);
        assert!(event::was_event_emitted(&MarketplaceFeeUpdated { old_bps: 200, new_bps: 250 }), 101);
        assert!(event::was_event_emitted(&MarketplaceFeeRecipientUpdated {
            old_recipient: @0xa,
            new_recipient: @0xb,
        }), 102);
        assert!(event::was_event_emitted(&MarketplacePauseUpdated {
            scope: PAUSE_GLOBAL,
            paused: true,
        }), 103);
    }
}
