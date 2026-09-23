/// Native Digital Asset launchpad. No token mutation, burn or seizure capabilities
/// are retained. The only stored signer capability controls an unowned drop object.
module launchpad::launchpad {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use std::option;
    use aptos_std::table::{Self, Table};
    use aptos_framework::object::{Self, ExtendRef};
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_token_objects::royalty;
    use launchpad::fee_policy;

    const EUNAUTHORIZED: u64 = 1;
    const EINVALID_TERMS: u64 = 2;
    const EFINALIZED: u64 = 3;
    const EMETADATA_COUNT: u64 = 4;
    const EDUPLICATE_METADATA: u64 = 5;
    const EINCOMPLETE: u64 = 6;
    const ENOT_FINALIZED: u64 = 7;
    const EPAUSED: u64 = 8;
    const ENOT_STARTED: u64 = 9;
    const EENDED: u64 = 10;
    const EQUANTITY: u64 = 11;
    const EWALLET_LIMIT: u64 = 12;
    const ESUPPLY: u64 = 13;
    const EPRICE_CHANGED: u64 = 14;
    const EMAX_TOTAL: u64 = 15;
    const EFEE_REVIEW: u64 = 16;
    const EINVALID_METADATA: u64 = 17;
    const EDROP_NOT_FOUND: u64 = 18;
    const EINSUFFICIENT_APT: u64 = 19;
    const MAX_SUPPLY: u64 = 10000;
    const MAX_MINT_QUANTITY: u64 = 20;
    const MAX_METADATA_CHUNK: u64 = 25;

    struct Terms has copy, drop, store {
        creator: address,
        name: String,
        description: String,
        collection_uri: String,
        max_supply: u64,
        unit_price: u64,
        wallet_limit: u64,
        transaction_limit: u64,
        start_seconds: u64,
        end_seconds: u64,
        royalty_bps: u64,
        fee_bps: u64,
    }
    struct Metadata has copy, drop, store { name: String, uri: String }
    struct Drop has key {
        authority: ExtendRef,
        terms: Terms,
        metadata: Table<u64, Metadata>,
        names: Table<String, bool>,
        uris: Table<String, bool>,
        wallet_mints: Table<address, u64>,
        uploaded: u64,
        minted: u64,
        collection: address,
        finalized: bool,
        creator_paused: bool,
        admin_paused: bool,
    }
    struct DropView has copy, drop, store {
        terms: Terms, uploaded: u64, minted: u64, collection: address,
        finalized: bool, creator_paused: bool, admin_paused: bool,
    }

    #[event]
    struct DropPrepared has drop, store { drop: address, terms: Terms }
    #[event]
    struct MetadataAppended has drop, store { drop: address, offset: u64, count: u64 }
    #[event]
    struct CollectionCreated has drop, store {
        drop: address, collection: address, terms: Terms, timestamp: u64,
    }
    #[event]
    struct NFTMinted has drop, store {
        drop: address, collection: address, token: address, serial: u64,
        creator: address, buyer: address, treasury: address,
        unit_price: u64, fee: u64, creator_revenue: u64, timestamp: u64,
    }
    #[event]
    struct CollectionPauseUpdated has drop, store {
        drop: address, actor: address, creator_paused: bool, admin_paused: bool,
    }

    fun seed(raw: vector<u8>): vector<u8> {
        assert!(vector::length(&raw) > 0 && vector::length(&raw) <= 64, EINVALID_TERMS);
        let result = b"launchpad::drop::v1::";
        vector::append(&mut result, raw);
        result
    }

    #[view]
    public fun drop_address(creator: address, id: vector<u8>): address {
        object::create_object_address(&creator, seed(id))
    }

    fun require_drop(drop: address) {
        assert!(exists<Drop>(drop), EDROP_NOT_FOUND);
    }

    fun assert_running() {
        let (_, _, paused, _) = fee_policy::configuration();
        assert!(!paused, EPAUSED);
    }

    // Bounded on-chain URI shape check. CID parsing, image validation and retrieval
    // are an upload-layer responsibility; chain code cannot prove IPFS availability.
    fun validate_uri(uri: &String) {
        let bytes = string::bytes(uri);
        let length = vector::length(bytes);
        assert!(length > 7 && length <= 512, EINVALID_METADATA);
        let prefix = b"ipfs://";
        let i = 0;
        while (i < 7) {
            assert!(*vector::borrow(bytes, i) == *vector::borrow(&prefix, i), EINVALID_METADATA);
            i += 1;
        };
        // Delimiters, escape sequences, whitespace and control bytes are rejected.
        while (i < length) {
            let c = *vector::borrow(bytes, i);
            assert!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)
                || c == 47 || c == 45 || c == 95 || c == 46, EINVALID_METADATA);
            if (c == 46) {
                assert!(i + 1 == length || *vector::borrow(bytes, i + 1) != 46, EINVALID_METADATA);
            };
            if (c == 47) {
                assert!(i > 7 && i + 1 < length && *vector::borrow(bytes, i - 1) != 47, EINVALID_METADATA);
            };
            i += 1;
        };
    }

    public entry fun prepare_drop(
        creator: &signer, id: vector<u8>, name: String, description: String,
        collection_uri: String, max_supply: u64, unit_price: u64,
        wallet_limit: u64, transaction_limit: u64,
        start_seconds: u64, end_seconds: u64, royalty_bps: u64, expected_fee_bps: u64,
    ) {
        assert_running();
        let (fee_bps, _, _, _) = fee_policy::configuration();
        assert!(fee_bps == expected_fee_bps, EFEE_REVIEW);
        assert!(max_supply > 0 && max_supply <= MAX_SUPPLY, EINVALID_TERMS);
        assert!(wallet_limit > 0 && wallet_limit <= max_supply, EINVALID_TERMS);
        assert!(transaction_limit > 0 && transaction_limit <= wallet_limit && transaction_limit <= MAX_MINT_QUANTITY, EINVALID_TERMS);
        assert!(start_seconds >= timestamp::now_seconds(), EINVALID_TERMS);
        assert!(end_seconds == 0 || end_seconds > start_seconds, EINVALID_TERMS);
        assert!(royalty_bps <= 10000, EINVALID_TERMS);
        assert!(string::length(&name) > 0 && string::length(&name) <= 128 && string::length(&description) <= 2048, EINVALID_TERMS);
        validate_uri(&collection_uri);
        let constructor = object::create_named_object(creator, seed(id));
        // Remove creator ownership as well as transfer ability. Owning a parent
        // object must not confer any authority over its collection or resources.
        object::transfer_with_constructor_ref(&constructor, @0x0);
        object::disable_ungated_transfer(&object::generate_transfer_ref(&constructor));
        let authority = object::generate_extend_ref(&constructor);
        let drop_signer = object::generate_signer(&constructor);
        let drop = signer::address_of(&drop_signer);
        let terms = Terms {
            creator: signer::address_of(creator), name, description, collection_uri,
            max_supply, unit_price, wallet_limit, transaction_limit,
            start_seconds, end_seconds, royalty_bps, fee_bps,
        };
        move_to(&drop_signer, Drop {
            authority, terms, metadata: table::new(), names: table::new(), uris: table::new(),
            wallet_mints: table::new(), uploaded: 0, minted: 0, collection: @0x0,
            finalized: false, creator_paused: false, admin_paused: false,
        });
        event::emit(DropPrepared { drop, terms });
    }

    public entry fun append_metadata(
        creator: &signer, drop: address, offset: u64, names: vector<String>, uris: vector<String>,
    ) acquires Drop {
        require_drop(drop);
        let data = borrow_global_mut<Drop>(drop);
        assert!(signer::address_of(creator) == data.terms.creator, EUNAUTHORIZED);
        assert!(!data.finalized, EFINALIZED);
        let count = vector::length(&names);
        assert!(count > 0 && count <= MAX_METADATA_CHUNK && count == vector::length(&uris), EMETADATA_COUNT);
        assert!(offset == data.uploaded && count <= data.terms.max_supply - data.uploaded, EMETADATA_COUNT);
        let i = 0;
        while (i < count) {
            let name = *vector::borrow(&names, i);
            let uri = *vector::borrow(&uris, i);
            assert!(string::length(&name) > 0 && string::length(&name) <= 128, EINVALID_METADATA);
            validate_uri(&uri);
            assert!(!table::contains(&data.names, name) && !table::contains(&data.uris, uri), EDUPLICATE_METADATA);
            table::add(&mut data.names, name, true);
            table::add(&mut data.uris, uri, true);
            table::add(&mut data.metadata, offset + i + 1, Metadata { name, uri });
            i += 1;
        };
        data.uploaded += count;
        event::emit(MetadataAppended { drop, offset, count });
    }

    public entry fun finalize_drop(creator: &signer, drop: address, expected_fee_bps: u64) acquires Drop {
        assert_running();
        require_drop(drop);
        let data = borrow_global_mut<Drop>(drop);
        assert!(signer::address_of(creator) == data.terms.creator, EUNAUTHORIZED);
        assert!(!data.finalized, EFINALIZED);
        assert!(data.uploaded == data.terms.max_supply, EINCOMPLETE);
        assert!(data.terms.fee_bps == expected_fee_bps, EFEE_REVIEW);
        let now = timestamp::now_seconds();
        assert!(data.terms.end_seconds == 0 || now < data.terms.end_seconds, EENDED);
        let authority = object::generate_signer_for_extending(&data.authority);
        let constructor = collection::create_fixed_collection(
            &authority, data.terms.description, data.terms.max_supply, data.terms.name,
            option::some(royalty::create(data.terms.royalty_bps, 10000, data.terms.creator)),
            data.terms.collection_uri,
        );
        // Native create_fixed_collection already disables transfer; do not retain
        // its ConstructorRef, ExtendRef or any metadata/supply/royalty MutatorRef.
        data.collection = object::address_from_constructor_ref(&constructor);
        data.finalized = true;
        event::emit(CollectionCreated { drop, collection: data.collection, terms: data.terms, timestamp: now });
    }

    public entry fun mint(buyer: &signer, drop: address, quantity: u64, expected_unit_price: u64, max_total: u64) acquires Drop {
        require_drop(drop);
        let data = borrow_global_mut<Drop>(drop);
        assert!(data.finalized, ENOT_FINALIZED);
        let (_, treasury, paused, _) = fee_policy::configuration();
        assert!(!paused && !data.creator_paused && !data.admin_paused, EPAUSED);
        let now = timestamp::now_seconds();
        assert!(now >= data.terms.start_seconds, ENOT_STARTED);
        assert!(data.terms.end_seconds == 0 || now < data.terms.end_seconds, EENDED);
        assert!(quantity > 0 && quantity <= data.terms.transaction_limit, EQUANTITY);
        let buyer_address = signer::address_of(buyer);
        let prior = *table::borrow_with_default(&data.wallet_mints, buyer_address, &0);
        assert!(quantity <= data.terms.wallet_limit - prior, EWALLET_LIMIT);
        assert!(quantity <= data.terms.max_supply - data.minted, ESUPPLY);
        assert!(expected_unit_price == data.terms.unit_price, EPRICE_CHANGED);
        let (total, platform, proceeds) = fee_policy::quote(data.terms.unit_price, quantity, data.terms.fee_bps);
        assert!(total <= max_total, EMAX_TOTAL);
        // A caller receiving part of its own payment must still cover the quoted gross.
        assert!(coin::balance<AptosCoin>(buyer_address) >= total, EINSUFFICIENT_APT);
        if (proceeds > 0) { aptos_account::transfer(buyer, data.terms.creator, proceeds); };
        if (platform > 0) { aptos_account::transfer(buyer, treasury, platform); };
        let authority = object::generate_signer_for_extending(&data.authority);
        let (_, unit_fee, unit_revenue) = fee_policy::quote(data.terms.unit_price, 1, data.terms.fee_bps);
        let i = 0;
        while (i < quantity) {
            let serial = data.minted + 1;
            let metadata = table::borrow(&data.metadata, serial);
            let constructor = token::create_named_token(
                &authority, data.terms.name, data.terms.description, metadata.name, option::none(), metadata.uri,
            );
            let token_address = object::address_from_constructor_ref(&constructor);
            object::transfer_with_constructor_ref(&constructor, buyer_address);
            // ConstructorRef expires here; no token capabilities survive this scope.
            data.minted += 1;
            event::emit(NFTMinted {
                drop, collection: data.collection, token: token_address, serial,
                creator: data.terms.creator, buyer: buyer_address, treasury,
                unit_price: data.terms.unit_price, fee: unit_fee, creator_revenue: unit_revenue, timestamp: now,
            });
            i += 1;
        };
        *table::borrow_mut_with_default(&mut data.wallet_mints, buyer_address, 0) = prior + quantity;
    }

    public entry fun set_creator_paused(creator: &signer, drop: address, paused: bool) acquires Drop {
        require_drop(drop);
        let data = borrow_global_mut<Drop>(drop);
        assert!(signer::address_of(creator) == data.terms.creator, EUNAUTHORIZED);
        data.creator_paused = paused;
        event::emit(CollectionPauseUpdated { drop, actor: signer::address_of(creator), creator_paused: data.creator_paused, admin_paused: data.admin_paused });
    }

    public entry fun set_admin_paused(caller: &signer, drop: address, paused: bool) acquires Drop {
        let (_, _, _, admin) = fee_policy::configuration();
        assert!(signer::address_of(caller) == admin, EUNAUTHORIZED);
        require_drop(drop);
        let data = borrow_global_mut<Drop>(drop);
        data.admin_paused = paused;
        event::emit(CollectionPauseUpdated { drop, actor: admin, creator_paused: data.creator_paused, admin_paused: data.admin_paused });
    }

    #[view]
    public fun get_drop(drop: address): DropView acquires Drop {
        require_drop(drop);
        let data = borrow_global<Drop>(drop);
        DropView { terms: data.terms, uploaded: data.uploaded, minted: data.minted, collection: data.collection,
            finalized: data.finalized, creator_paused: data.creator_paused, admin_paused: data.admin_paused }
    }

    #[view]
    public fun progress(drop: address): vector<u64> acquires Drop {
        require_drop(drop);
        let data = borrow_global<Drop>(drop);
        vector[data.uploaded, data.minted, data.terms.max_supply]
    }

    #[view]
    public fun minted_by(drop: address, buyer: address): u64 acquires Drop {
        require_drop(drop);
        *table::borrow_with_default(&borrow_global<Drop>(drop).wallet_mints, buyer, &0)
    }

    #[view]
    public fun collection_address(drop: address): address acquires Drop {
        require_drop(drop);
        let data = borrow_global<Drop>(drop);
        assert!(data.finalized, ENOT_FINALIZED);
        data.collection
    }

    #[view]
    public fun token_address(drop: address, serial: u64): address acquires Drop {
        require_drop(drop);
        let data = borrow_global<Drop>(drop);
        assert!(serial > 0 && serial <= data.uploaded, EMETADATA_COUNT);
        token::create_token_address(&drop, &data.terms.name, &table::borrow(&data.metadata, serial).name)
    }

    #[view]
    public fun metadata(drop: address, serial: u64): Metadata acquires Drop {
        require_drop(drop);
        let data = borrow_global<Drop>(drop);
        assert!(serial > 0 && serial <= data.uploaded, EMETADATA_COUNT);
        *table::borrow(&data.metadata, serial)
    }

    #[view]
    public fun limits(): (u64, u64, u64) { (MAX_SUPPLY, MAX_MINT_QUANTITY, MAX_METADATA_CHUNK) }

    #[test_only]
    public fun assert_mint_events_for_test(drop: address, buyer: address, treasury: address, quantity: u64, price: u64, fee: u64, revenue: u64) {
        let events = event::emitted_events<NFTMinted>();
        assert!(vector::length(&events) == quantity, 100);
        let i = 0;
        while (i < quantity) {
            let item = vector::borrow(&events, i);
            assert!(item.drop == drop && item.buyer == buyer && item.treasury == treasury && item.serial == i + 1, 101);
            assert!(item.unit_price == price && item.fee == fee && item.creator_revenue == revenue, 102);
            assert!(item.unit_price == item.fee + item.creator_revenue && item.timestamp == timestamp::now_seconds(), 103);
            i += 1;
        };
    }
}
