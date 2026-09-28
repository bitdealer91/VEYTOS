# Independent security challenge review

Date: 2026-09-28. Reviewed branch: `feature/audit-readiness` at `54450c0`, with security-test commit `88ccd57` immediately below it. Baseline main: `d77a27b`.

This is an independent challenge of the audit-readiness package, not an external audit report. Production Move sources and manifests were reviewed as authoritative where documentation differed. No production Move code was changed. One test-only regression was added after reproducing a concrete Token V1 buyer-risk path.

## Executive decision

- **READY FOR EXTERNAL AUDIT: YES.** The code, trust boundaries, evidence and known gaps are sufficiently organized for intake. The exact reviewed artifact must be frozen, and the HIGH V1 creator-burn finding below must be included in scope and remediated/retested before any audit is treated as complete.
- **READY FOR PUBLIC TESTNET BETA: YES, ignoring missing infrastructure credentials.** Limit V1 to controlled fixtures or keep V1 paused until the creator-burn behavior is fixed; disclose compatible upgrade and testnet-only authority. This is not approval for value-bearing use.
- **READY FOR MAINNET: NO.** A concrete V1 buyer-protection defect exists; no external audit is complete; both packages remain compatible; governance is proposed rather than implemented; current-mainnet framework behavior, reimbursement calibration, V2 dossiers, public beta and operational gates remain incomplete.

Finding count: **0 CRITICAL, 3 HIGH, 1 MEDIUM, 1 LOW, 2 INFORMATIONAL**.

## Baseline reproduced

The initial checkout was clean on `feature/audit-readiness`. `git log` showed `54450c0` at HEAD, then `88ccd57`, then main baseline `d77a27b`. Before this review's added test:

- Move: 82 launchpad + 114 marketplace = **196/196**.
- Node/TypeScript: **71/71**.
- Frontend: **57/57** across 8 files.
- Workspace/frontend typecheck: passed.
- Production Next.js build: passed.

The branch changes no production `.move` file or Move manifest relative to `d77a27b`. The audit package's historical validation record is reproducible, but it is not deployed-bytecode or current-mainnet proof.

## Security findings

### HIGH — Token V1 creator-burn authority survives sale

- **Affected module:** `marketplace::settlement_v1`, principally `list` at `move/marketplace/sources/settlement_v1.move:52` and delivery in `buy` at line 134. The relevant dependency is `0x3::token::burn_by_creator` in the pinned Aptos Token V1 framework.
- **Preconditions:** TokenData has `maximum == 1`, the seller owns exactly one matching TokenId, and TokenData default properties contain the reserved boolean `TOKEN_BURNABLE_BY_CREATOR = true`. The token otherwise passes current identity, balance and royalty checks.
- **Failure/exploit path:** a creator mints the burnable token; a holder lists it; VEYTOS accepts and escrows it; a buyer pays and receives it; the creator calls `0x3::token::burn_by_creator` against the buyer's TokenStore. The sale remains SOLD and payment remains final while the buyer's balance becomes zero.
- **Impact:** irreversible post-purchase loss of the purchased NFT at creator discretion. V1 has no reviewed-collection registry and the Move adapter does not inspect this reserved TokenData property.
- **Existing mitigation:** private escrow prevents creator burn while the linear Token is inside VEYTOS's table. The compatibility documents require per-token validation and the four sampled TokenData rows had empty default property maps, but neither the contract nor frontend eligibility enforces the creator-burn condition for arbitrary direct callers.
- **Recommended action:** review a production design separately. At minimum, reject creator-burnable V1 TokenData on chain. Because the pinned public API does not expose TokenData default properties cleanly for every nonzero property-version case, consider a deny-by-default V1 registry/provenance policy or a narrower supported V1 subset rather than relying on frontend reads. Add buyer-facing disclosure only as defense in depth, not as the sole control.
- **Blocks external audit:** **No**; it should be an explicit audit finding/remediation item.
- **Blocks mainnet:** **Yes** for enabled arbitrary V1 listing.
- **Reproducibility:** confirmed by the new passing test `audit_v1_creator_burn_authority_survives_purchase`.

No production code was modified after this defect was identified.

### HIGH — Compatible publisher authority remains total custody authority

- **Affected module:** both packages; `move/launchpad/Move.toml:3` and `move/marketplace/Move.toml:3` specify `compatible`.
- **Preconditions:** publisher authority is malicious or compromised before upgrade authority is irreversibly removed.
- **Failure/exploit path:** publish compatible code or an additional same-package module that changes package-visible lifecycle/custody behavior, exposes retained capabilities, redirects settlement or bypasses operational checks.
- **Impact:** potential theft, trapping or economic redirection affecting every package-held asset and future operation.
- **Existing mitigation:** proposed cold 3-of-5 publisher governance, review procedure and planned immutability; none is currently enforced by this branch.
- **Recommended action:** keep publisher governance separate and cold during audit/beta; freeze immutable only after the conditions below are met. Verify the deployed package policy and bytecode independently.
- **Blocks external audit:** **No**.
- **Blocks mainnet:** **Yes** until the chosen policy is implemented and independently verified.

### HIGH — Approved V2 collections can retain authority that defeats escrow

- **Affected module:** `marketplace::settlement_v2::list` (`move/marketplace/sources/settlement_v2.move:60`) and the collection registry at `marketplace::marketplace::set_v2_collection_reviewed` (`move/marketplace/sources/marketplace.move:355`).
- **Preconditions:** the marketplace admin approves a collection whose creator or another party retained a usable TransferRef or comparable capability; a holder lists a token from it.
- **Failure/exploit path:** listing checks current direct ownership, ungated transfer and reviewed collection, then moves the token to isolated escrow. An external retained TransferRef can move the token without the escrow signer. Subsequent cancel/buy owner assertions abort. A retained burn capability may similarly destroy availability.
- **Impact:** seller asset loss or trapped terminal operations. Buyer payments roll back if delivery aborts, but the seller's NFT may already be gone.
- **Existing mitigation:** deny-by-default registry, provenance enum, test demonstrating the retained-TransferRef threat, and V2/global pause. Revocation alone does not stop an existing BUY.
- **Recommended action:** require per-collection capability and upgrade-policy dossiers, independent technical review, current active-escrow review before approval/unpause, and explicit denial where capability reachability cannot be proved safe.
- **Blocks external audit:** **No**.
- **Blocks mainnet:** **Yes** for any collection without current evidence.

### MEDIUM — Marketplace operational authority combines incompatible duties

- **Affected module:** `marketplace::marketplace_fee_policy` setters at lines 115–198 and registry authorization at `marketplace::marketplace:355`.
- **Preconditions:** compromise or misuse of the marketplace operational quorum.
- **Failure/exploit path:** the same signer can redirect the fee destination for existing listings, change future fee/reimbursement snapshots, pause any scope, nominate its successor and approve an unsafe V2 collection. Unsafe approval composes with the V2 retained-capability finding.
- **Impact:** denial of service, economic redirection and indirect custody loss through unsafe collection admission.
- **Existing mitigation:** caps, two-step admin succession and no direct admin escrow-transfer function.
- **Recommended action:** use a dedicated marketplace 2-of-3 with independent registry review and decoded-payload approval. On-chain least-privilege separation would require a separately reviewed production change; do not claim the present contract provides it.
- **Blocks external audit:** **No**.
- **Blocks mainnet:** **Yes** until governance and procedures are implemented/rehearsed.

### LOW — Storage reimbursement is a policy transfer, not a measured refund

- **Affected module:** defaults/cap and setters in `marketplace_fee_policy.move:23-25,133-157`; snapshot in `marketplace.move:233-250`; buyer-funded seller transfer at `marketplace.move:331-333`.
- **Preconditions:** stale or poorly chosen reimbursement configuration, differing identity/storage sizes, sponsored gas, protocol pricing changes, or a price near the u64 boundary.
- **Failure/exploit path:** the buyer pays the snapshotted constant in addition to gross even when the actual validator refund differs or accrues to a different gas payer. At extreme price/reimbursement combinations, settlement can be unexecutable while cancellation remains available.
- **Impact:** systematic over/under-compensation or an unbuyable listing; no replay or gross-conservation break was found.
- **Existing mitigation:** per-standard cap, immutable listing snapshot, buyer expected-value check, cancellation without reimbursement and atomic abort.
- **Recommended action:** calibrate V1/V2 separately using current FeeStatement evidence, identity sizes and actual gas-payer model; define who economically owns the protocol refund; monitor and revise only future snapshots.
- **Blocks external audit:** **No**.
- **Blocks mainnet:** **Yes** until calibrated and accepted as policy.

### INFORMATIONAL — Historical pins do not pin current deployed framework behavior

- **Affected module:** both Move manifests and every framework-dependent invariant.
- **Preconditions:** mainnet system modules/features differ from either historical source pin or change through framework governance.
- **Failure/exploit path:** compilation remains reproducible while runtime ABI, enabled features, object/token semantics, gas/storage behavior or package-policy behavior differs on the target ledger.
- **Impact:** deployment aborts, custody availability failure, incorrect refund assumptions or invalid release evidence.
- **Existing mitigation:** exact git pins and historical testnet evidence.
- **Recommended action:** perform the current-mainnet checks listed below immediately before deployment and record ledger version/framework package hashes.
- **Blocks external audit:** **No**, provided the auditor reviews the assumption.
- **Blocks mainnet:** **Yes** until revalidated.

### INFORMATIONAL — Four legacy collection samples justify no stronger than per-token validation

- **Affected module:** V1 support policy and `settlement_v1::list`.
- **Preconditions:** attempting to infer collection-wide compatibility from the four sampled TokenData rows.
- **Failure/exploit path:** an unsampled token or current owner state differs in maximum, property version, balance, royalty, reserved properties, delegation or post-sample mutation.
- **Impact:** false support claims and buyer/seller exposure.
- **Existing mitigation:** exact TokenId/balance/maximum/royalty checks and conservative documentation.
- **Recommended action:** retain **REQUIRES PER-TOKEN VALIDATION** for Aptos Monkeys, Aptomingos, Bruh Bears and Pontem Space Pirates. Add creator-burn/default-property checks to the required procedure. Do not promote any collection from the available evidence.
- **Blocks external audit:** **No**.
- **Blocks mainnet:** **No** by itself if V1 is disabled; **Yes** for enabling arbitrary V1 without the HIGH finding's remediation.

## Challenge of all 38 stated invariants

“Code” below means production VEYTOS code under unchanged bytecode. “Framework” means the claim additionally depends on Aptos system-module/VM semantics. “Convention” is operational and not enforced by the package. Test status uses the audit package's representative-fixture definition, except S03 is downgraded because the expected-failure transaction cannot assert committed post-replay balances.

| ID | Actual enforcement | Independent test assessment | Challenge result |
| --- | --- | --- | --- |
| L01 | Code + framework | Covered | Supply counter and fixed collection maximum are both checked; no native bypass was found. |
| L02 | Code | Covered | Per-address lifetime counter is enforced; not Sybil resistance. |
| L03 | Code | Covered | Stored updates and quote input are capped at 1000 bps. |
| L04 | Code + framework arithmetic | Covered | u128 products and per-token rounding conserve total within u64. |
| L05 | Current-code absence; defeated by upgrade | Partial | True only for reviewed unchanged bytecode; not unconditional admin safety. |
| L06 | Current-code absence + off-chain content assumption | Partial | On-chain fields lack setters after finalization; IPFS syntax does not prove immutable/available content. |
| L07 | Code | Covered | All three mint pauses are checked; holder transfer is outside launchpad pause authority. |
| M01 | Code + VM atomicity | Covered | ACTIVE is required and success records SOLD; “exactly once” still assumes atomic transactions. |
| M02 | Code | Covered | CANCELLED cannot pass active/escrow checks. |
| M03 | Code | Covered | SOLD cannot pass active/escrow checks. |
| M04 | Code | Covered | No price setter exists; relist gets a new monotonic ID. |
| M05 | Code | Covered | Fee rate is snapshotted; current recipient is deliberately dynamic. |
| M06 | Code | Covered | Exact fraction/payee snapshot survives native mutation. |
| M07 | Code + u128 arithmetic | Covered | Floors are independent and seller remainder must be positive. |
| M08 | Code + VM atomicity | Partial | Active key and escrow are terminally removed, but committed race/rollback evidence is incomplete. |
| M09 | Code | Partial | Two-step transfer works; old-admin revocation is not exhaustively checked for every setter. |
| V201 | Framework AUID/ExtendRef + code privacy | Partial | Unique signer design is sound at the pin; current-mainnet semantics and exhaustive capability reachability remain assumptions. |
| V202 | Framework ownership | Partial | Cross-escrow negative test exists but is generic-abort and pin-dependent. |
| V203 | Code | Partial | Adapter moves only table-recorded token, but unrelated-asset coverage is not exhaustive across all terminal paths. |
| V204 | Current-code absence; defeated by upgrade/external capability | Partial | Operational admin has no direct seizure API; this is not a publisher or collection-capability guarantee. |
| V205 | Code + current token transferability | Covered | Cancel omits pause check; external restriction/capability can still make transfer fail. |
| V206 | Code + framework canonical collection | Covered | Stored exact token/collection is delivered and owner rechecked. |
| V207 | Code | Covered | Revoke blocks new list, not existing buy; cancel remains available if token is movable. |
| V208 | Convention, not on-chain provenance proof | Partial | Test proves ungated transfer is insufficient; safe review itself is operational. |
| V101 | Code | Partial | Exact tuple is retained, but all wrong-field and terminal combinations are not directly asserted. |
| V102 | Code | Partial | property_version is in TokenId/asset key and one nonzero success exists; collision matrix is incomplete. |
| V103 | Code + Token V1 linearity | Partial | Exact Token amount is privately stored; malformed/delegated variants remain incomplete. |
| V104 | Code for max/balance/royalty; incomplete V1 safety predicate | Partial | Stated checks exist, but the invariant set omits creator-burnable TokenData accepted by production code. |
| V105 | Code | Partial | No broad withdrawal authority exists; buy/cancel/unrelated pending-state coverage is incomplete. |
| V106 | Code | Covered | Cancel authenticates seller and uses signer deposit without pause/opt-in dependency. |
| V107 | Framework + code custody isolation | Covered | Delegation cannot reach private table but revives for its recorded owner after return. |
| S01 | Code | Covered | Reimbursement is a separate snapshot and expected argument, not a deduction from gross. |
| S02 | Code | Covered | Cancel contains no buyer or reimbursement transfer. |
| S03 | Code ordering + VM atomicity | **Partial (downgraded)** | Replay reaches missing escrow before payment, but current expected-failure tests cannot inspect a separately committed first purchase and second attempt. |
| S04 | Protocol/economic acceptance only | Not covered | No unit test can prove current validator refund amount or beneficiary. |
| A01 | VM transaction semantics | Partial | Source/order and one abort test support it; committed delivery/payment failure evidence is missing. |
| A02 | Code signer/state checks | Partial | Direct-chain authority is real; the negative actor/adapter matrix is not exhaustive. |
| A03 | Release ceremony/package metadata | Not covered and currently false | Both manifests remain compatible; no immutable publish/rejection evidence exists. |

**Revised coverage for the stated 38:** **19 covered / 17 partial / 2 not covered**. The earlier 20/16/2 is defensible only if S03's source ordering plus a same-transaction expected failure is called full coverage. This review does not. The 38-obligation inventory is also incomplete: it needs a separate V1 post-delivery creator-authority obligation. The new test covers the existence of that failure path; production does not prevent it.

## Disposition of non-fully-covered areas

### A — owner remediation before audit sign-off

- **V104 plus omitted V1 creator authority:** retain the new regression and review a production fix separately. This does not prevent audit intake, but it blocks a clean audit conclusion and mainnet V1 enablement.
- **M09/A02:** tighten high-value authorization tests to exact abort locations for every privileged setter/registry path where cheap; this reduces false-positive expected failures.
- **S03:** add a two-transaction committed replay/balance check to acceptance evidence, not another same-transaction expected-failure test.

### B — reasonable external-auditor work or remediation-cycle tests

- **L05/L06:** capability reachability, absence of retained launchpad refs, and exact meaning of immutable metadata.
- **M08, V201–V204, V208, V101–V105:** package-visible trust, cross-listing authority, malformed Token V1 states, exact property-version/key distinctions, unrelated asset/pending-state isolation, and retained V2 capabilities.
- **Event assertions:** current helper omits full asset identity, timestamps, reimbursement and recipient fields across both adapters. Expand only where the auditor or indexer threat model needs those fields.
- **Pause combinations:** source logic is simple and cancellations intentionally bypass pause. Exhaustive global/V1/V2 LIST/BUY/CANCEL combinations are useful regression coverage but not a substitute for capability review.
- **Numerical/state-growth edges:** listing-ID exhaustion, seller-total overflow, hostile string sizes and long-lived table growth are suitable focused auditor tests/analysis.

### C — requires real validator/testnet/release acceptance

- **A01/S03 committed atomicity:** separate transactions for failed payment/delivery, cancel/buy races and replay, with committed state and balances.
- **S04:** FeeStatement refund amount/beneficiary, V1/V2 identity sizes, sponsored gas and current storage pricing.
- **A03:** actual immutable publication/policy transition, rejected upgrade attempt, deployed bytecode/metadata hashes and account authority evidence.
- Multisig entry payload execution, successor acceptance, old-admin rejection, incident cancellation path and current-mainnet framework/features.

No test was added merely to raise the count. The creator-burn test was added because it reproduces a concrete asset-loss path. The remaining gaps above either do not materially benefit from another unit fixture or require design/protocol evidence.

## Adversarial custody conclusions

### V2

- Cross-listing ExtendRef misuse was not achieved: each table entry stores a unique AUID-derived ExtendRef and cross-escrow signer transfer fails under the pinned framework.
- Marketplace code retains no NFT TransferRef/BurnRef/MutatorRef. The dangerous retained authority is external to VEYTOS and must be excluded by registry review.
- Operations address only the exact token stored under the listing ID; no broad wallet or collection withdrawal path was found.
- Escrow replay and terminal listing reuse fail before a second transfer. Terminal listing records remain as tombstones while active key and escrow are removed.
- Registry revoke correctly blocks new listings but leaves existing buy possible. It is not a containment pause.
- Pause blocks LIST/BUY and preserves CANCEL. Cancellation can still fail if an external capability moved, burned or transfer-restricted the token.

### V1

- TokenId equality includes creator, collection string, token name and property_version; no collision or version-collapse path was found.
- `maximum == 1`, seller exact balance `== 1`, actual withdrawal, returned amount and tuple equality reject semi-fungible/multi-balance aliases.
- A WithdrawCapability targets an owner's TokenStore, not VEYTOS's private Token table. It can revive after cancel or after buy only for the address recorded in that capability.
- Authenticated `deposit_token` returns the exact linear Token and does not require receiver direct-transfer opt-in.
- Missing TokenData/TokenStore and malformed royalty paths fail closed under the pin, though exact abort coverage is incomplete.
- No unrelated-token withdrawal path was found.
- **Exploit constructed:** creator-burnable V1 passes listing and sale, after which the creator burns it from the buyer. This is distinct from escrow safety: custody is safe during escrow but buyer ownership is not durable.

## Economic challenge

`quote_sale` implements:

```text
fee = floor(gross * fee_bps / 10_000)
royalty = floor(gross * numerator / denominator)
seller proceeds = gross - fee - royalty
gross = fee + royalty + seller proceeds
```

Products use u128 and outputs fit u64 because each component is bounded by gross. `fee + royalty < gross` guarantees positive seller proceeds. Zero price, zero denominator, numerator over denominator, positive royalty to zero address, excessive deductions and fee above 500 bps abort. Near-zero values allocate rounding remainder to the seller. Max-u64 multiplication is safe; the additional reimbursement can still make an otherwise valid extreme listing unbuyable, with atomic rollback and safe cancel.

Storage reimbursement is added to seller proceeds and never subtracted from gross. It is paid once on successful terminal settlement; cancel pays none. No overpayment replay was found. Manipulation is administrative/policy-based: a compromised admin may choose any future snapshot up to 10,000,000 octas, while a stale constant can diverge from the actual protocol refund or refund beneficiary. Buyer expected-value matching prevents a silent term change but does not prove fairness.

Recipient aliasing does not violate the allocation equation, but wallet net deltas can differ when buyer, seller, treasury or royalty payee coincide. Launchpad separately prechecks that the buyer holds the full quoted gross, which avoids relying on intra-transaction self-receipts.

## Governance challenge and minimum viable mainnet structure

The proposed thresholds are plausible only with actual signer independence:

- dedicated launchpad operations **2-of-3**;
- dedicated marketplace operations **2-of-3**;
- separate cold treasury **3-of-5**;
- separate cold publisher governance **3-of-5 per package only until immutability**.

No person, seed, hardware device or two-person coalition should satisfy quorums across operations, treasury and publisher domains. Treasury membership should not automatically imply publisher membership. The marketplace 2-of-3 is unavoidably broad in current code: it can redirect current-listing platform fees, alter future terms, pause trading and approve unsafe V2 collections. Require an independent technical approver and dossier for registry actions even though the chain cannot enforce that separation. Publisher authority can do all of the above and interfere directly with custody through upgrades; it is the highest-risk role. Treasury alone cannot alter contracts or custody.

Minimum ceremony: hardware-backed members, verified account policy, decoded payloads, simulation, independent address comparison, event/state confirmation, two-step admin succession rehearsal, old-admin negative check, backup/recovery drill and documented quorum-conflict rules. Do not market these separations until deployed accounts and membership overlap have been reviewed.

## Immutability decision

Immutable mainnet publication remains the preferred end state, but **not yet**. It removes the strongest VEYTOS-controlled custody authority and stabilizes audit scope. It also removes the fastest in-place remediation path for V1 legacy defects and future framework incompatibility. Migration then means a new versioned package plus voluntary cancel/relist; a V2 asset already moved or locked by an external capability may not be migratable.

Before freezing upgrade authority, all of the following must be true:

1. external review and remediation/retest are complete for exact source, pins and artifacts, including the V1 creator-burn finding;
2. public testnet beta and committed atomicity/race/cancel recovery evidence are complete;
3. both packages' target addresses, initialization order/configuration and deployed bytecode/metadata hashes are independently verified;
4. current-mainnet framework/VM/package-policy behavior is validated;
5. V2 registry dossiers and V1 enablement policy are final; preferably freeze before accepting value and begin with V1 paused until its risk is resolved;
6. reimbursement is calibrated and its beneficiary policy approved;
7. operations/treasury governance and incident/cancellation routes are rehearsed;
8. active escrow is zero at the freeze boundary, or every active escrow is explicitly reconciled; and
9. a versioned replacement-package, user notice and voluntary migration plan exists.

## Framework-pin risks requiring current-mainnet revalidation

The launchpad pin (`1b116b…`) and marketplace pin (`831c39…`) differ. Both are reproducibility inputs, not runtime pins. Immediately before deployment, verify against the deployed ledger:

- ABI and enabled-feature availability for every imported public function;
- AUID uniqueness and `transaction_context::generate_auid_address` behavior used by `create_unique_onchain_signer`;
- ExtendRef signer generation and the no-ObjectCore lightweight signer model;
- object direct/nested ownership, ungated transfer and external TransferRef/BurnRef behavior;
- canonical V2 collection relationship and token-versus-collection royalty inheritance/mutation;
- Token V1 TokenId/property_version equality, TokenStore deposit/withdraw, exact balance, maximum/mutation, reserved burn properties and WithdrawCapability expiration/owner behavior;
- `aptos_account::transfer` behavior under current primary fungible-store migration, including recipient aliases and account creation;
- VM transaction atomicity for multi-transfer plus custody failure and concurrent cancel/buy;
- table deletion/storage slot refund beneficiary, FeeStatement fields, current pricing and sponsored gas;
- module-event schema/indexing behavior used by reconciliation;
- compatible-to-immutable package-policy transition and rejection of later upgrades; and
- framework package hashes/ledger version used for the acceptance evidence.

Official current documentation continues to describe FeeStatement storage refunds and immutable package locking, while current aptos-core source still exposes the relevant object and Token V1 functions. That is useful compatibility evidence, not a substitute for target-ledger acceptance.

## V1 legacy collection assessment

The evidence supports exactly **REQUIRES PER-TOKEN VALIDATION** for Aptos Monkeys, Aptomingos, Bruh Bears and Pontem Space Pirates. Each sampled row showed maximum/supply 1/1 and a structurally plausible royalty, but the reads were separate snapshots and did not establish the current holder's TokenStore amount, exact owned property_version, real withdrawal, outstanding delegations, creator-burn flag for every token, later mutation or collection-wide behavior. Bruh Bears' sampled TokenData largest property version of 1 reinforces that version zero must never be assumed.

The four sampled default property maps were empty, so the new creator-burn exploit is not established for those exact samples. It does invalidate any policy that checks only maximum/balance/royalty. No collection is promoted to generally supported.

## Test added and validation target

Added `audit_v1_creator_burn_authority_survives_purchase` in `move/marketplace/tests/settlement_v1_tests.move`. It constructs maximum-1, valid-royalty TokenData with the native reserved creator-burn flag, completes LIST/BUY, then proves the creator can burn the buyer's token after payment while the listing remains SOLD.

Expected final Move count: **197** (82 launchpad + 115 marketplace). Final validation must rerun both Move packages, Node/TypeScript, frontend, typecheck, production build and `git diff --check` after this document is added.
