# Test coverage matrix

Status: internal preparation only; no independent external audit has been completed. Mainnet release remains blocked. Baseline: main `d77a27b`, 2026-09-26.

Reviewed against `docs/MARKETPLACE_CONTRACT_TEST_PLAN.md`, `SECURITY.md`, `ARCHITECTURE.md`, both packages' production source and existing Move test modules. Baseline: 82 launchpad + 100 marketplace = 182; Phase 3C adds focused marketplace tests. A matching scenario prefix is not sufficient evidence.

“Covered” means direct executable assertions exercise the stated behavior in representative unit fixtures, not exhaustive proof. “Partially covered” means a subset, source inspection, generic abort, or incomplete state/evidence assertions. “Not covered” means no relevant executable unit test. Expected-abort unit tests cannot inspect committed post-abort state, so they do not establish validator-level rollback or gas/refund behavior.

Test modules resolve to `move/launchpad/tests/{module}.move` for launchpad_tests/fee_policy_tests, otherwise `move/marketplace/tests/{module}.move`. Inline `configuration_events` tests also live in each fee-policy source; they cover only the events they explicitly assert.

## L01 — covered

Module: `launchpad_tests`. Tests: `remaining_supply_limit`, `sold_out`, `creator_cannot_mint_as_native_creator`.

## L02 — covered

Module: `launchpad_tests`. Tests: `wallet_lifetime_limit`.

## L03 — covered

Module: `fee_policy_tests`. Tests: `admin_cannot_exceed_fee_cap`, `quote_fee_cap`.

## L04 — covered

Module: `fee_policy_tests`. Tests: `fee_split_conserves_revenue`, `fee_rounding_is_batch_invariant`, `full_u64_range_uses_wide_intermediate`, `total_overflow_rejected`.

## L05 — partially covered

Module: `launchpad_tests`. Tests: `admin_cannot_seize_holder_nft`, `creator_cannot_transfer_authority`.

## L06 — partially covered

Module: `launchpad_tests`. Tests: `post_finalize_append`, `double_finalize`, `fee_snapshot_rounding_and_treasury_rotation`.

## L07 — covered

Module: `launchpad_tests`. Tests: `mint_platform_paused`, `mint_creator_paused`, `mint_admin_paused`, `admin_cannot_clear_creator_pause`, `holder_transfers_while_platform_paused`.

## M01 — covered

Module: `marketplace_tests`. Tests: `g07_buy_listing`, `g11_sold_replay`.

## M02 — covered

Module: `settlement_v1_tests; settlement_v2_tests; marketplace_tests`. Tests: `audit_v1_cancel_then_buy_rejected`, `v224_cancel_then_buy_fails`, `g10_cancelled_replay`.

## M03 — covered

Module: `settlement_v1_tests; settlement_v2_tests`. Tests: `audit_v1_double_buy_rejected`, `audit_v1_buy_then_cancel_rejected`, `v225_buy_then_cancel_fails`, `v232_double_buy_fails`.

## M04 — covered

Module: `marketplace_tests`. Tests: `g13_immutable_price`, `g12_wrong_expected_price`.

## M05 — covered

Module: `marketplace_tests`. Tests: `g14_fee_snapshot`, `g15_recipient_rotation`.

## M06 — covered

Module: `settlement_v1_tests; settlement_v2_tests`. Tests: `v111_mutable_royalty_uses_listing_snapshot`, `v212_mutable_royalty_snapshot`.

## M07 — covered

Module: `marketplace_fee_policy_tests`. Tests: `f15_combined_conservation`, `f16_excessive_deductions`, `f17_u64_boundary`, `audit_u128_product_boundary`.

## M08 — partially covered

Module: `marketplace_tests; settlement_v1_tests; settlement_v2_tests`. Tests: `g03_asset_key_uniqueness`, `g04_cross_standard_key_separation`, `g05_cancel_listing`, `v102_cancel_returns_exact_token`, `v202_successful_cancel`.

## M09 — partially covered

Module: `marketplace_fee_policy_tests; settlement_v2_tests; fee_policy_tests`. Tests: `f10_two_step_admin_transfer`, `f11_wrong_admin_acceptance`, `audit_old_admin_cannot_pause`, `audit_v2_old_admin_cannot_update_registry`, `old_admin_loses_authority`.

## V201 — partially covered

Module: `settlement_v2_tests`. Tests: `v213_isolated_capability_scope`, `v234_lightweight_escrow_has_no_terminal_shell`.

## V202 — partially covered

Module: `settlement_v2_tests`. Tests: `v213_isolated_capability_scope`.

## V203 — partially covered

Module: `settlement_v2_tests`. Tests: `v220_unrelated_assets_untouched`.

## V204 — partially covered

Module: `settlement_v2_tests`. Tests: `v216_admin_cannot_move_escrow`.

## V205 — covered

Module: `settlement_v2_tests`. Tests: `v222_pause_does_not_trap_cancellation`.

## V206 — covered

Module: `settlement_v2_tests`. Tests: `v203_successful_buy`, `v207_collection_identity`.

## V207 — covered

Module: `settlement_v2_tests`. Tests: `v218_unreviewed_collection_rejected`, `audit_v2_revocation_does_not_block_existing_buy`, `v228_revocation_does_not_trap_existing_escrow`.

## V208 — partially covered

Module: `settlement_v2_tests`. Tests: `v219_retained_creator_transfer_ref_threat`, `v218_unreviewed_collection_rejected`.

## V101 — partially covered

Module: `settlement_v1_tests`. Tests: `v102_cancel_returns_exact_token`, `v103_buy_delivers_exact_token`, `v105_wrong_identity_fails`.

## V102 — partially covered

Module: `settlement_v1_tests`. Tests: `v106_nonzero_property_version`.

## V103 — partially covered

Module: `settlement_v1_tests`. Tests: `v101_successful_escrow`, `v108_exact_amount_is_one`, `v119_preexisting_withdraw_capability_cannot_withdraw_escrow`.

## V104 — partially covered

Module: `settlement_v1_tests`. Tests: `v104_unowned_token_listing_fails`, `v107_semi_fungible_rejected`, `v110_malformed_royalty_rejected`.

## V105 — partially covered

Module: `settlement_v1_tests`. Tests: `v118_unrelated_token_remains_untouched`, `audit_v1_cancel_paused_preserves_other_escrow_and_balances`.

## V106 — covered

Module: `settlement_v1_tests`. Tests: `v113_cancel_does_not_require_direct_transfer_opt_in`, `audit_v1_cancel_paused_preserves_other_escrow_and_balances`, `audit_v1_admin_cannot_cancel`.

## V107 — covered

Module: `settlement_v1_tests`. Tests: `v119_preexisting_withdraw_capability_cannot_withdraw_escrow`, `audit_v1_seller_capability_revives_after_cancel`, `audit_v1_preexisting_buyer_capability_after_purchase`.

## S01 — covered

Module: `marketplace_tests; settlement_v2_tests`. Tests: `g23_storage_reimbursement_snapshot`, `g24_wrong_expected_storage_reimbursement`, `v233_wrong_storage_reimbursement_leaves_purchase_unexecutable`.

## S02 — covered

Module: `settlement_v1_tests; settlement_v2_tests`. Tests: `audit_v1_cancel_paused_preserves_other_escrow_and_balances`, `audit_v2_cancel_charges_no_reimbursement`.

## S03 — covered

Module: `settlement_v1_tests; settlement_v2_tests`. Tests: `audit_v1_double_buy_rejected`, `v232_double_buy_fails`.

## S04 — not covered

Module: `none (validator integration required)`. Tests: `No Move unit test; historical FeeStatement evidence only`.

## A01 — partially covered

Module: `settlement_v2_tests`. Tests: `v231_insufficient_payment_aborts_purchase`.

## A02 — partially covered

Module: `settlement_v1_tests; settlement_v2_tests; marketplace_tests`. Tests: `v104_unowned_token_listing_fails`, `v204_unowned_object`, `g06_unauthorized_cancel`.

## A03 — not covered

Module: `none (release verification required)`. Tests: `No package-policy integration test`.

## Gaps found in the original test plan

- F05/F08/F10/F11: fee quote cap, update-to-zero recipient, previous-admin revocation, zero nominee and accept-without-nomination are distinct branches. New tests cover zero recipient update, old-admin pause and old-admin registry update; nomination edge cases remain missing in marketplace tests (launchpad has them). Full setting-by-setting revocation is still partial.
- F17: existing max gross used small royalty numerator. Added near-u128 multiplication with max-u64 numerator/denominator and one-octa seller remainder. Seller-proceeds-plus-reimbursement overflow and listing-ID exhaustion remain untested.
- F18: source checks zero price in shared create_listing after adapter reads/withdrawal/transfer. It aborts atomically; the older plan's “before royalty reads/escrow creation” ordering is not implemented. No production change made.
- G04/G06/G09/G12: missing exhaustive property-version key comparisons, all unauthorized actor/adapter combinations, unknown-ID buy, and both sides of price mismatch. New V1 admin cancel test adds a concrete privilege regression.
- G17–G21/A13: V1 actual custody cancellation under global+adapter pause was missing; added it. All eight global/V1/V2 pause combinations with both standards remain incomplete.
- G22: common event helper checks a subset of fields, not every identity, timestamp and reimbursement across adapters. Success tests do not all check events, balances and custody as the plan requested.
- V105/V106: wrong-name and nonzero-version buy exist; all wrong tuple fields, nonzero-version cancel and independent key comparisons remain partial.
- V107/V110/V115: maximum!=1, zero balance and zero royalty denominator are exercised; balance>1 with otherwise accepted state, zero-payee native V1 royalty, numerator>denominator in adapter, explicit creator burn attempt and missing/corrupt TokenData variations remain incomplete. New pure quote test covers numerator>denominator, not adapter construction.
- V116/V117/V118: old tests mostly observe absent wallet balance/unrelated list-time balance. Added real admin-cancel abort and two simultaneous V1 escrows with cancellation isolation. Buy isolation and unrelated pending claims still need fixtures.
- V119/V120: old V120 created a capability AFTER purchase; it did not test pre-existing buyer delegation. Added actual pre-existing buyer capability and seller capability after cancellation. These demonstrate a residual standard risk, not a marketplace exploit.
- V213/V215/V216 and several V1 negative tests accept any abort. Exact framework abort locations/codes should be tightened after reviewing fixture reachability; a generic setup abort could falsely pass. V214 checks no escrow ObjectCore, not a static proof of all absent token capabilities.
- V217–V220: existing revoked-collection new-list rejection is complemented by new existing-buy success and old-admin registry rejection tests. Review authority is operational; tests cannot prove absence of privately retained creator capabilities for real collections. Unrelated ownership coverage is not exhaustive across list/cancel/buy.
- A01–A07: insufficient-payment generic abort and replay tests exist, but forced fee/royalty/delivery failures, corrupt escrow fixtures and separate committed-transaction rollback/race evidence are incomplete. A single expected-abort test rolls back its setup too; do not equate it with a committed first purchase followed by a failed replay.
- A08–A12: source derives identities; UI/indexer tests exist separately, but the Move suite does not exercise hostile metadata limits, adversarial input gas bounds, stale provider integration or complete ambiguity reconciliation.
- A14: code inspection plus transfer-abort tests support the operational boundary; no package-publish/upgrade adversarial test proves release governance or immutable metadata.
- Storage: new cancel-balance checks complement existing snapshot/expected-value tests. V1 nonzero reimbursement settlement, recipient aliasing, refund calibration across identity lengths and sponsored gas payer remain open integration cases. Unit tests do not execute FeeStatement accounting.

## Specification corrections, not production changes

V2 escrow now uses a unique signer address without an ObjectCore shell (V201/V202 wording in the old plan is historical). V1 is implemented; old SECURITY.md implementation/test counts are historical. The release source default for V1 reimbursement is zero even though the acceptance run configured 926400 octas. Upgradeability and registry compromise remain trust assumptions, not test failures.
