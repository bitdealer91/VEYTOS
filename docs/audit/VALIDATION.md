# Phase 3C validation record

Date: 2026-09-26. Branch: `feature/audit-readiness` from main `d77a27b`.
Archived command output has terminal carriage returns/trailing whitespace normalized for repository hygiene; test results are unchanged.
Toolchain observed: Node v24.9.0, npm 11.6.0, Aptos CLI 9.6.0.

## Baseline before edits

Initial checkout was clean `feature/public-beta-deploy` at `c03b37b`. Switched to clean local main tracking origin/main at `d77a27b`, excluding the unmerged deployment commit. The main-branch last five commits were:

```text
d77a27b Merge pull request #2 from bitdealer91/feature/public-beta
cdf9350 feat: refine marketplace navigation and account UX
5c3f192 feat: discover launchpad drops from projection
f7a6b3a fix: make public beta shell mobile safe
fc6ee86 docs: prepare public beta deployment
```

Before creating audit changes: `npm test` 71/71; `npm run test:frontend` 57/57 across 8 files; `npm run move:test` 82 launchpad +100 marketplace =182/182; `npm run typecheck`, `npm run build`, `git diff --check` all exited zero. Marketplace was also run independently once (100/100); this is not counted twice. [Baseline logs](../evidence/phase3c-validation/baseline/move.txt) and adjacent node/frontend/typecheck/build logs are archived.

## Final checks

After final test edits, all commands ran again successfully:

- `npm run move:test`: **196/196**, comprising unchanged launchpad 82 and marketplace 114.
- `npm test`: **71/71** Node/TypeScript tests.
- `npm run test:frontend`: **57/57** frontend tests, 8 files.
- `npm run typecheck`: root and frontend successful.
- `npm run build`: production Next.js build successful.
- `git diff --check`: successful; new documents checked again after evidence assembly.

[Final Move log](../evidence/phase3c-validation/final/move.txt), [Node](../evidence/phase3c-validation/final/node.txt), [frontend](../evidence/phase3c-validation/final/frontend.txt), [typecheck](../evidence/phase3c-validation/final/typecheck.txt), [build](../evidence/phase3c-validation/final/build.txt).

All six production `.move` files and both Move.toml files compare byte-for-byte equal to `git show d77a27b:<path>`; `git diff d77a27b -- move/launchpad/sources move/marketplace/sources move/launchpad/Move.toml move/marketplace/Move.toml` is empty. [Production source SHA-256 manifest](PRODUCTION_SOURCE_SHA256.json) records exact source bytes; this is not a deployed-bytecode comparison.

[Move test inventory](MOVE_TEST_INVENTORY.json) lists all 196 tests by module and flags generic versus code-specific expected failures. The invariant matrix references actual test names, not just scenario numbers. Documentation links and named references were checked locally. Coverage disposition: 38 obligations, 20 covered, 16 partial, 2 not covered by Move unit tests; these are representative coverage labels, not proof percentages.

## Security tests added (14)

`marketplace_fee_policy_tests`:

- `audit_old_admin_cannot_pause`: previous admin rejected after accepted succession.
- `audit_u128_product_boundary`: max-u64 gross/fraction product preserves one-octa seller remainder.
- `audit_royalty_numerator_over_denominator`: invalid fraction rejected.
- `audit_zero_recipient_update`: treasury update rejects zero.

`settlement_v1_tests`:

- `audit_v1_cancel_paused_preserves_other_escrow_and_balances`: real adapter cancel under combined pause preserves another listing and buyer principal.
- `audit_v1_cancel_then_buy_rejected`, `audit_v1_double_buy_rejected`, `audit_v1_buy_then_cancel_rejected`: adapter terminal replay branches.
- `audit_v1_admin_cannot_cancel`: actual unauthorized admin cancellation rejected.
- `audit_v1_seller_capability_revives_after_cancel`: documents pre-existing seller delegation risk after return.
- `audit_v1_preexisting_buyer_capability_after_purchase`: capability exists before listing/purchase and can act afterward, unlike the older post-purchase capability fixture.

`settlement_v2_tests`:

- `audit_v2_revocation_does_not_block_existing_buy`: records current registry semantics, not an assertion that revocation is a pause.
- `audit_v2_old_admin_cannot_update_registry`: registry follows accepted admin succession.
- `audit_v2_cancel_charges_no_reimbursement`: cancellation preserves buyer principal and returns the NFT without reimbursement transfer.

No production behavior was changed to make tests pass. Unit tests do not measure validator gas/deletion refunds, run deployment, establish mainnet configuration, prove all abort rollback states, or replace external audit.

## Research and operational limits

Fresh public mainnet ledger/resource/table reads succeeded for all four V1 samples; raw responses and ledger versions are in `docs/evidence/phase3c-v1-readonly.json`. No signing, transaction submission or custody simulation occurred. No secrets review, provider deployment, multisig ceremony, package freeze or new testnet acceptance transaction was performed. Historical testnet evidence is referenced with those limits in AUDIT_HANDOFF.
