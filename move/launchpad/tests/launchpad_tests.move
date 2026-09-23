#[test_only]
module launchpad::launchpad_tests {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use std::option;
    use aptos_std::string_utils;
    use aptos_framework::account;
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_framework::object;
    use aptos_token_objects::token::{Self, Token};
    use aptos_token_objects::collection::{Self, Collection};
    use aptos_token_objects::royalty;
    use launchpad::fee_policy;
    use launchpad::launchpad;

    fun setup(): (signer, signer, signer) {
        let framework = account::create_account_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&framework);
        timestamp::update_global_time_for_test_secs(100);
        let admin = account::create_account_for_test(@launchpad);
        let creator = account::create_account_for_test(@0xa);
        let buyer = account::create_account_for_test(@0xb);
        fee_policy::initialize(&admin, @0xc);
        aptos_account::deposit_fungible_assets(@0xb, aptos_coin::mint_apt_fa_for_test(100000000000));
        (admin, creator, buyer)
    }

    fun uri(id: u64): String {
        let value = string::utf8(b"ipfs://bafkreif6g5nfvt6ccuapmnqbvgqvfnghlj7bx2p4yjftvfv2u4kaeqlh3i/");
        string::append(&mut value, string_utils::to_string(&id));
        string::append_utf8(&mut value, b".json");
        value
    }

    fun prepare(creator: &signer, supply: u64, price: u64, wallet: u64, per_tx: u64, start: u64, end: u64): address {
        launchpad::prepare_drop(creator, b"test", string::utf8(b"Collection"), string::utf8(b"Description"),
            uri(0), supply, price, wallet, per_tx, start, end, 750, 500);
        launchpad::drop_address(signer::address_of(creator), b"test")
    }

    fun append(creator: &signer, drop: address, offset: u64, count: u64) {
        let names = vector[];
        let uris = vector[];
        let i = 0;
        while (i < count) {
            let id = offset + i + 1;
            let name = string::utf8(b"NFT #");
            string::append(&mut name, string_utils::to_string(&id));
            vector::push_back(&mut names, name);
            vector::push_back(&mut uris, uri(id));
            i += 1;
        };
        launchpad::append_metadata(creator, drop, offset, names, uris);
    }

    fun ready(creator: &signer, supply: u64, price: u64, wallet: u64, per_tx: u64): address {
        let drop = prepare(creator, supply, price, wallet, per_tx, 110, 200);
        append(creator, drop, 0, supply);
        launchpad::finalize_drop(creator, drop, 500);
        timestamp::update_global_time_for_test_secs(110);
        drop
    }

    #[test]
    fun prepare_append_finalize_native_collection() {
        let (_, creator, _) = setup();
        let drop = prepare(&creator, 3, 1000000000, 3, 2, 110, 200);
        assert!(launchpad::progress(drop) == vector[0, 0, 3], 100);
        append(&creator, drop, 0, 2);
        append(&creator, drop, 2, 1);
        launchpad::finalize_drop(&creator, drop, 500);
        let col = object::address_to_object<Collection>(launchpad::collection_address(drop));
        assert!(collection::name(col) == string::utf8(b"Collection"), 101);
        assert!(collection::creator(col) == drop, 102);
        let royalty = option::destroy_some(royalty::get(col));
        assert!(royalty::numerator(&royalty) == 750 && royalty::denominator(&royalty) == 10000, 103);
        assert!(royalty::payee_address(&royalty) == @0xa, 104);
        assert!(launchpad::progress(drop) == vector[3, 0, 3], 105);
    }

    #[test]
    fun multi_mint_transfers_native_tokens_and_exact_payments() {
        let (_, creator, buyer) = setup();
        let drop = ready(&creator, 3, 1000000000, 3, 2);
        launchpad::mint(&buyer, drop, 2, 1000000000, 2000000000);
        assert!(coin::balance<AptosCoin>(@0xb) == 98000000000, 100);
        assert!(coin::balance<AptosCoin>(@0xa) == 1900000000, 101);
        assert!(coin::balance<AptosCoin>(@0xc) == 100000000, 102);
        assert!(launchpad::progress(drop) == vector[3, 2, 3], 103);
        assert!(launchpad::minted_by(drop, @0xb) == 2, 104);
        assert!(option::destroy_some(collection::count(object::address_to_object<Collection>(launchpad::collection_address(drop)))) == 2, 109);
        launchpad::assert_mint_events_for_test(drop, @0xb, @0xc, 2, 1000000000, 50000000, 950000000);
        let i = 1;
        while (i <= 2) {
            let nft = object::address_to_object<Token>(launchpad::token_address(drop, i));
            assert!(object::owner(nft) == @0xb, 105);
            assert!(object::object_address(&token::collection_object(nft)) == launchpad::collection_address(drop), 106);
            assert!(token::uri(nft) == uri(i), 107);
            let r = option::destroy_some(token::royalty(nft));
            assert!(royalty::numerator(&r) == 750, 108);
            i += 1;
        };
    }

    #[test]
    fun single_mint_and_free_mint() {
        let (_, creator, buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 1);
        launchpad::mint(&buyer, drop, 1, 0, 0);
        assert!(coin::balance<AptosCoin>(@0xb) == 100000000000, 100);
        assert!(coin::balance<AptosCoin>(@0xa) == 0 && coin::balance<AptosCoin>(@0xc) == 0, 101);
        assert!(object::owner(object::address_to_object<Token>(launchpad::token_address(drop, 1))) == @0xb, 102);
    }

    #[test]
    fun fee_snapshot_rounding_and_treasury_rotation() {
        let (admin, creator, buyer) = setup();
        let drop = prepare(&creator, 2, 999, 2, 2, 110, 200);
        fee_policy::set_fee(&admin, 1000);
        append(&creator, drop, 0, 2);
        launchpad::finalize_drop(&creator, drop, 500);
        fee_policy::set_recipient(&admin, @0xd);
        timestamp::update_global_time_for_test_secs(110);
        launchpad::mint(&buyer, drop, 2, 999, 1998);
        assert!(coin::balance<AptosCoin>(@0xd) == 98, 100);
        assert!(coin::balance<AptosCoin>(@0xc) == 0, 101);
        assert!(coin::balance<AptosCoin>(@0xa) == 1900, 102);
    }

    #[test]
    fun holder_transfers_while_platform_paused() {
        let (admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 2);
        launchpad::mint(&buyer, drop, 1, 0, 0);
        fee_policy::set_paused(&admin, true);
        let nft = object::address_to_object<Token>(launchpad::token_address(drop, 1));
        object::transfer(&buyer, nft, @0xe);
        assert!(object::owner(nft) == @0xe, 100);
        assert!(launchpad::minted_by(drop, @0xb) == 1, 101);
    }

    #[test]
    #[expected_failure(abort_code = 9, location = launchpad::launchpad)]
    fun mint_before_start() {
        let (_admin, creator, buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 0, 2); launchpad::finalize_drop(&creator, drop, 500); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 10, location = launchpad::launchpad)]
    fun mint_at_end() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); timestamp::update_global_time_for_test_secs(200); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 10, location = launchpad::launchpad)]
    fun mint_after_end() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); timestamp::update_global_time_for_test_secs(201); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 7, location = launchpad::launchpad)]
    fun mint_not_finalized() {
        let (_admin, creator, buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = launchpad::launchpad)]
    fun mint_platform_paused() {
        let (admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); fee_policy::set_paused(&admin, true); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = launchpad::launchpad)]
    fun mint_creator_paused() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); launchpad::set_creator_paused(&creator, drop, true); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = launchpad::launchpad)]
    fun mint_admin_paused() {
        let (admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); launchpad::set_admin_paused(&admin, drop, true); launchpad::set_creator_paused(&creator, drop, false); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = launchpad::launchpad)]
    fun admin_cannot_clear_creator_pause() {
        let (admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); launchpad::set_creator_paused(&creator, drop, true); launchpad::set_admin_paused(&admin, drop, false); launchpad::mint(&buyer, drop, 1, 10, 10);
    }

    #[test]
    #[expected_failure(abort_code = 12, location = launchpad::launchpad)]
    fun wallet_lifetime_limit() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 3, 0, 1, 1); launchpad::mint(&buyer, drop, 1, 0, 0); object::transfer(&buyer, object::address_to_object<Token>(launchpad::token_address(drop, 1)), @0xe); launchpad::mint(&buyer, drop, 1, 0, 0);
    }

    #[test]
    #[expected_failure(abort_code = 13, location = launchpad::launchpad)]
    fun remaining_supply_limit() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 3, 0, 3, 2); launchpad::mint(&buyer, drop, 2, 0, 0); launchpad::mint(&creator, drop, 2, 0, 0);
    }

    #[test]
    #[expected_failure(abort_code = 13, location = launchpad::launchpad)]
    fun sold_out() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 1, 0, 1, 1); launchpad::mint(&buyer, drop, 1, 0, 0); launchpad::mint(&creator, drop, 1, 0, 0);
    }

    #[test]
    #[expected_failure(abort_code = 11, location = launchpad::launchpad)]
    fun quantity_zero() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 2); launchpad::mint(&buyer, drop, 0, 0, 0);
    }

    #[test]
    #[expected_failure(abort_code = 11, location = launchpad::launchpad)]
    fun quantity_over_limit() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 3, 0, 3, 2); launchpad::mint(&buyer, drop, 3, 0, 0);
    }

    #[test]
    #[expected_failure(abort_code = 14, location = launchpad::launchpad)]
    fun wrong_expected_price() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); launchpad::mint(&buyer, drop, 1, 9, 10);
    }

    #[test]
    #[expected_failure(abort_code = 15, location = launchpad::launchpad)]
    fun max_total_protection() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 10, 2, 2); launchpad::mint(&buyer, drop, 2, 10, 19);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = launchpad::launchpad)]
    fun unauthorized_append() {
        let (_admin, creator, buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&buyer, drop, 0, 1);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = launchpad::launchpad)]
    fun unauthorized_finalize() {
        let (_admin, creator, buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 0, 2); launchpad::finalize_drop(&buyer, drop, 500);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = launchpad::launchpad)]
    fun unauthorized_creator_pause() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 2); launchpad::set_creator_paused(&buyer, drop, true);
    }

    #[test]
    #[expected_failure(abort_code = 1, location = launchpad::launchpad)]
    fun unauthorized_admin_pause() {
        let (_admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 2); launchpad::set_admin_paused(&buyer, drop, true);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = launchpad::launchpad)]
    fun metadata_overwrite() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 0, 1); append(&creator, drop, 0, 1);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = launchpad::launchpad)]
    fun metadata_gap() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 1, 1);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = launchpad::launchpad)]
    fun duplicate_metadata_uri() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); launchpad::append_metadata(&creator, drop, 0, vector[string::utf8(b"A"), string::utf8(b"B")], vector[uri(1), uri(1)]);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = launchpad::launchpad)]
    fun duplicate_metadata_name() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); launchpad::append_metadata(&creator, drop, 0, vector[string::utf8(b"A"), string::utf8(b"A")], vector[uri(1), uri(2)]);
    }

    #[test]
    #[expected_failure(abort_code = 6, location = launchpad::launchpad)]
    fun incomplete_finalize() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 0, 1); launchpad::finalize_drop(&creator, drop, 500);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = launchpad::launchpad)]
    fun metadata_supply_mismatch() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 1, 10, 1, 1, 110, 200); append(&creator, drop, 0, 2);
    }

    #[test]
    #[expected_failure(abort_code = 3, location = launchpad::launchpad)]
    fun post_finalize_append() {
        let (_admin, creator, _buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 2); append(&creator, drop, 2, 1);
    }

    #[test]
    #[expected_failure(abort_code = 3, location = launchpad::launchpad)]
    fun double_finalize() {
        let (_admin, creator, _buyer) = setup();
        let drop = ready(&creator, 2, 0, 2, 2); launchpad::finalize_drop(&creator, drop, 500);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun zero_supply() {
        let (_admin, creator, _buyer) = setup();
        prepare(&creator, 0, 10, 1, 1, 110, 200);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun excessive_supply() {
        let (_admin, creator, _buyer) = setup();
        prepare(&creator, 10001, 10, 1, 1, 110, 200);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun invalid_wallet_limit() {
        let (_admin, creator, _buyer) = setup();
        prepare(&creator, 2, 10, 3, 1, 110, 200);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun invalid_transaction_limit() {
        let (_admin, creator, _buyer) = setup();
        prepare(&creator, 2, 10, 2, 3, 110, 200);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun invalid_schedule() {
        let (_admin, creator, _buyer) = setup();
        prepare(&creator, 2, 10, 2, 2, 110, 110);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun past_schedule() {
        let (_admin, creator, _buyer) = setup();
        prepare(&creator, 2, 10, 2, 2, 99, 200);
    }

    #[test]
    #[expected_failure(abort_code = 10, location = launchpad::launchpad)]
    fun expired_finalize() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 0, 2); timestamp::update_global_time_for_test_secs(200); launchpad::finalize_drop(&creator, drop, 500);
    }

    #[test]
    #[expected_failure(abort_code = 16, location = launchpad::launchpad)]
    fun fee_review_mismatch() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 2, 10, 2, 2, 110, 200); append(&creator, drop, 0, 2); launchpad::finalize_drop(&creator, drop, 250);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = launchpad::launchpad)]
    fun prepare_paused() {
        let (admin, creator, _buyer) = setup();
        fee_policy::set_paused(&admin, true); prepare(&creator, 2, 10, 2, 2, 110, 200);
    }

    #[test]
    #[expected_failure(abort_code = 17, location = launchpad::launchpad)]
    fun invalid_metadata_uri() {
        let (_admin, creator, _buyer) = setup();
        let drop = prepare(&creator, 1, 10, 1, 1, 110, 200); launchpad::append_metadata(&creator, drop, 0, vector[string::utf8(b"A")], vector[string::utf8(b"https://attacker.test/a")]);
    }

    #[test]
    fun exact_maximum_supply_and_open_ended_schedule() {
        let (_, creator, buyer) = setup();
        let drop = prepare(&creator, 10000, 0, 10000, 20, 100, 0);
        assert!(launchpad::progress(drop) == vector[0, 0, 10000], 100);
        // Separate drop proves no end is represented by zero, including long after start.
        launchpad::prepare_drop(&creator, b"open", string::utf8(b"Open"), string::utf8(b""), uri(0), 1, 0, 1, 1, 100, 0, 0, 500);
        let open = launchpad::drop_address(@0xa, b"open");
        append(&creator, open, 0, 1);
        launchpad::finalize_drop(&creator, open, 500);
        timestamp::update_global_time_for_test_secs(99999);
        launchpad::mint(&buyer, open, 1, 0, 0);
        assert!(launchpad::minted_by(open, @0xb) == 1, 101);
    }

    #[test]
    fun pause_unpause_restores_minting() {
        let (admin, creator, buyer) = setup();
        let drop = ready(&creator, 2, 1, 2, 2);
        fee_policy::set_paused(&admin, true);
        launchpad::set_creator_paused(&creator, drop, true);
        launchpad::set_admin_paused(&admin, drop, true);
        fee_policy::set_paused(&admin, false);
        launchpad::set_creator_paused(&creator, drop, false);
        launchpad::set_admin_paused(&admin, drop, false);
        launchpad::mint(&buyer, drop, 1, 1, 1);
        assert!(coin::balance<AptosCoin>(@0xa) == 1, 100);
        assert!(coin::balance<AptosCoin>(@0xc) == 0, 101);
        launchpad::assert_mint_events_for_test(drop, @0xb, @0xc, 1, 1, 0, 1);
    }

    #[test]
    fun max_price_uses_u128_and_pays_native_apt() {
        let (_, creator, buyer) = setup();
        // Fill the buyer's existing store to exactly u64::MAX using real framework coins.
        aptos_account::deposit_fungible_assets(@0xb, aptos_coin::mint_apt_fa_for_test(18446743973709551615));
        let drop = ready(&creator, 1, 18446744073709551615, 1, 1);
        launchpad::mint(&buyer, drop, 1, 18446744073709551615, 18446744073709551615);
        assert!(coin::balance<AptosCoin>(@0xb) == 0, 100);
        assert!(coin::balance<AptosCoin>(@0xc) == 922337203685477580, 101);
        assert!(coin::balance<AptosCoin>(@0xa) == 17524406870024074035, 102);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = launchpad::fee_policy)]
    fun mint_total_overflow() {
        let (_, creator, buyer) = setup();
        let drop = ready(&creator, 2, 18446744073709551615, 2, 2);
        launchpad::mint(&buyer, drop, 2, 18446744073709551615, 18446744073709551615);
    }

    #[test]
    #[expected_failure(abort_code = 19, location = launchpad::launchpad)]
    fun insufficient_apt() {
        let (_, creator, buyer) = setup();
        let drop = ready(&creator, 1, 100000000001, 1, 1);
        launchpad::mint(&buyer, drop, 1, 100000000001, 100000000001);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = launchpad::launchpad)]
    fun invalid_royalty() {
        let (_, creator, _) = setup();
        launchpad::prepare_drop(&creator, b"test", string::utf8(b"C"), string::utf8(b""), uri(0), 1, 0, 1, 1, 100, 0, 10001, 500);
    }

    #[test]
    #[expected_failure(abort_code = 16, location = launchpad::launchpad)]
    fun changed_fee_before_preparation_requires_review() {
        let (admin, creator, _) = setup();
        fee_policy::set_fee(&admin, 600);
        prepare(&creator, 1, 0, 1, 1, 110, 0);
    }

    #[test]
    #[expected_failure(abort_code = 8, location = launchpad::launchpad)]
    fun finalize_platform_paused() {
        let (admin, creator, _) = setup();
        let drop = prepare(&creator, 1, 0, 1, 1, 110, 0);
        append(&creator, drop, 0, 1);
        fee_policy::set_paused(&admin, true);
        launchpad::finalize_drop(&creator, drop, 500);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = launchpad::launchpad)]
    fun metadata_chunk_bound() {
        let (_, creator, _) = setup();
        let drop = prepare(&creator, 30, 0, 30, 20, 110, 0);
        append(&creator, drop, 0, 26);
    }

    #[test]
    #[expected_failure(abort_code = 4, location = launchpad::launchpad)]
    fun metadata_array_length_mismatch() {
        let (_, creator, _) = setup();
        let drop = prepare(&creator, 1, 0, 1, 1, 110, 0);
        launchpad::append_metadata(&creator, drop, 0, vector[string::utf8(b"A")], vector[]);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = launchpad::launchpad)]
    fun duplicate_uri_across_chunks() {
        let (_, creator, _) = setup();
        let drop = prepare(&creator, 2, 0, 2, 2, 110, 0);
        append(&creator, drop, 0, 1);
        launchpad::append_metadata(&creator, drop, 1, vector[string::utf8(b"B")], vector[uri(1)]);
    }

    #[test]
    #[expected_failure(abort_code = 327683, location = aptos_framework::object)]
    fun creator_cannot_transfer_authority() {
        let (_, creator, _) = setup();
        let drop = ready(&creator, 1, 0, 1, 1);
        object::transfer_raw(&creator, drop, @0xa);
    }

    #[test]
    #[expected_failure(abort_code = 327683, location = aptos_framework::object)]
    fun creator_cannot_transfer_native_collection() {
        let (_, creator, _) = setup();
        let drop = ready(&creator, 1, 0, 1, 1);
        object::transfer_raw(&creator, launchpad::collection_address(drop), @0xa);
    }

    #[test]
    #[expected_failure(abort_code = 262152, location = aptos_token_objects::token)]
    fun creator_cannot_mint_as_native_collection_owner() {
        let (_, creator, _) = setup();
        let drop = ready(&creator, 1, 0, 1, 1);
        token::create_named_token_as_collection_owner(&creator,
            object::address_to_object<Collection>(launchpad::collection_address(drop)),
            string::utf8(b""), string::utf8(b"Bypass"), option::none(), uri(8));
    }

    #[test]
    #[expected_failure(abort_code = 262146, location = aptos_token_objects::token)]
    fun creator_cannot_mint_as_native_creator() {
        let (_, creator, _) = setup();
        let drop = ready(&creator, 1, 0, 1, 1);
        token::create_named_token_object(&creator,
            object::address_to_object<Collection>(launchpad::collection_address(drop)),
            string::utf8(b""), string::utf8(b"Bypass"), option::none(), uri(8));
    }

    #[test]
    #[expected_failure(abort_code = 327684, location = aptos_framework::object)]
    fun admin_cannot_seize_holder_nft() {
        let (admin, creator, buyer) = setup();
        let drop = ready(&creator, 1, 0, 1, 1);
        launchpad::mint(&buyer, drop, 1, 0, 0);
        object::transfer_raw(&admin, launchpad::token_address(drop, 1), @launchpad);
    }
}
