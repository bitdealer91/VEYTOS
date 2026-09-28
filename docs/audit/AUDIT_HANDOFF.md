# VEYTOS auditor handoff

No independent external audit has been completed. Mainnet remains blocked. Phase 3C is source/test/documentation preparation; no deployment or custody implementation changed.

## Start here

Baseline: verified main `d77a27b` (merge of public beta work), branch `feature/audit-readiness`. Unmerged deployment experiment `c03b37b` is excluded. Review the final handoff commit as recorded by `git log` with [VALIDATION.md](VALIDATION.md) and the evidence manifests. No release tag or mainnet publication is implied.

Read [AUDIT_SCOPE](AUDIT_SCOPE.md) for all six modules, entries, resources, capabilities, events, aborts and dependencies; [SECURITY_INVARIANTS](SECURITY_INVARIANTS.md) for 38 explicit obligations; [TEST_COVERAGE_MATRIX](TEST_COVERAGE_MATRIX.md) for real named test mappings and gaps. Then review [TRUST_MODEL](TRUST_MODEL.md), [PRIVILEGED_ROLES](PRIVILEGED_ROLES.md), [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md), [DEPLOYMENT_MODEL](DEPLOYMENT_MODEL.md), and [MAINNET_UPGRADE_POLICY](MAINNET_UPGRADE_POLICY.md).

## Repository and reproducibility

- `move/launchpad/{sources,tests}`, package MintosLaunchpad: fee_policy and launchpad. AptosFramework/AptosTokenObjects pin `1b116b414ccc1d860fa72160d9b9a770e8d8e88f`.
- `move/marketplace/{sources,tests}`, package VeytosMarketplace: marketplace_fee_policy, marketplace, settlement_v1, settlement_v2. AptosFramework/AptosTokenObjects/AptosToken pin `831c39cff4c5a8ead98ddffe0edfc4ba51623e91`.
- `packages/aptos`: payloads, reads, transaction reconciliation and NFT discovery; `packages/domain`: money/validation/state rules; `packages/database`: projections/schema; `packages/storage` and `packages/config`: storage interface and shared configuration.
- `apps/web`: Next.js wallet UI and tests; `scripts`: read-only research, acceptance and indexing tools; `docs/evidence`: historical public transaction/research records.
- Both Move manifests are `compatible`. Dev addresses 0xcafe/0xbeef are fixture addresses. Use official Aptos CLI (record actual version in validation) and Node >=22, locked dependencies with `npm ci` for a fresh installation. Reproduce both framework pins without substituting floating branches.

Local non-publishing commands from repository root:

```sh
npm test
npm run test:frontend
npm run move:test
npm run typecheck
npm run build
git diff --check
```

`npm run move:test` runs BOTH packages using `--dev`; `npm run move:marketplace:test` runs marketplace alone and is not needed in addition for a total. These commands do not publish. Acceptance scripts may sign/submit testnet transactions and are not required to start source review. Do not run them against mainnet or with production keys during audit intake.

## Threat and economic model

Direct-chain signer/ownership/listing state authorizes LIST/CANCEL/BUY. Frontend and database/indexer are not authoritative. Treat buyers, sellers, collection creators, external capability holders and operational actors as potentially adversarial. Upgrade authority is stronger than fee/pause admin. V2 reviewed registry is a trust boundary, not proof of capability safety.

APT amounts use octas (1 APT = 100000000 octas). Primary initial fee 500 bps, cap 1000; snapshot at prepare and confirmation at finalize. Platform = quantity * floor(unit price * bps / 10000), creator receives remainder; current treasury address is used. Supply <=10000, mint batch <=20, metadata chunk <=25, wallet limit is per address. Free mints use the same path. No retained native NFT seizure/mutation/burn capabilities.

Marketplace initial fee 200 bps, cap 500. Gross must be positive. Fee = floor(gross*bps/10000), royalty = floor(gross*n/d), seller receives gross minus both, strictly positive. Uses u128 products; exact royalty payee/fraction is snapshotted, with positive denominator and numerator<=denominator, nonzero payee for positive numerator. Fee recipient is current configuration at BUY. Self-buy is rejected. A launchpad royalty of 100% may be valid for mint but unacceptable for marketplace listing.

Reimbursement is added to seller proceeds, separate from sale conservation, snapshotted and matched by buyer. Source defaults V1=0, V2=926400 octas, cap 10000000 per standard. Testnet V1 acceptance explicitly configured 926400. CANCEL makes no contract reimbursement payment. Gas/deletion refunds require validator evidence and fresh release calibration; a constant is not a guarantee of actual refunds.

## Custody differences and priority risks

V1 withdraws one exact linear `0x3::token::Token` into a private table keyed by listing ID. Identity includes creator, collection, name and property_version. TokenData maximum and seller balance must each equal one. Cancel/buy deposit using the authenticated recipient signer, so direct-transfer opt-in is unnecessary. Pre-existing withdrawal delegation cannot reach escrow but may act after return to its recorded owner.

V2 transfers exact token to a unique per-listing signer address controlled by a private ExtendRef; no ObjectCore escrow shell remains. Direct native ownership, ungated transfer and canonical reviewed collection are required. External creator TransferRef can move an escrowed NFT; current owner assertions then abort delivery. Registry revoke blocks new LIST, not existing BUY; use V2/global pause to contain purchases. Both adapters retain safe seller cancellation during pause, subject to underlying asset transferability.

Please focus on capability reachability, package-visible helper assumptions, atomic delivery/payment failures, account/recipient aliases, extreme arithmetic including reimbursement, V1 malformed and delegated states, V2 provenance and mutable behavior, state-growth/gas limits, and governance. The coverage matrix marks partial/uncovered obligations rather than treating test count as completion.

## Existing testnet evidence (historical, not rerun here)

- [Launchpad Gate A](../../TESTNET_ACCEPTANCE.md), [JSON](../evidence/testnet-acceptance.json): 2026-09-23; package `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28`; publication, mint, balances/events and framework pin recorded.
- [V2 acceptance](../MARKETPLACE_TESTNET_ACCEPTANCE.md), [hardened JSON](../evidence/marketplace-v2-hardening-testnet.json): 2026-09-24; package `0x0cf2b5af2e168b4ba7f002f705e7f1c1954284756286167800e2b6b11ae6ab64`; lifecycle and FeeStatement evidence.
- [V1 acceptance](../MARKETPLACE_V1_TESTNET_ACCEPTANCE.md), [JSON](../evidence/marketplace-v1-testnet.json): 2026-09-24; package `0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb`; property-version 1 LIST/CANCEL/RELIST/BUY, exact settlement and reimbursement.
- Browser records: `docs/evidence/frontend-browser-mint.json`, `marketplace-v2-browser-rpc-acceptance.json`, `marketplace-v1-browser-acceptance.json`. Internal test wallets do not establish completed public external beta.

Each JSON includes transaction hashes and verification details. Compare source/bytecode digests before applying earlier results to a release; testnet addresses are not mainnet addresses.

## Unsupported configurations and intake blockers

No semi-fungible V1, nested/restricted/unreviewed V2, invalid royalty/deductions, marketplace zero price, arbitrary custody rescue, offers/auctions/bundles or cross-chain settlement. Historical [V1 compatibility matrix](../V1_COLLECTION_COMPATIBILITY_MATRIX.md) marks all four studied collections as requiring per-token validation; fresh read-only evidence does not certify transferability.

Before external audit starts: name independent auditor and private reporting channel, freeze exact review commit/artifact manifest, agree scope including framework assumptions and coverage gaps, designate finding owners and retest criteria, and provide collection review dossiers/operational proposals. Missing production credentials need not block source review. Before mainnet: all [release gates](../MAINNET_RELEASE_GATE.md), including resolved independent review, implemented multisig/policy, production services, external beta, secrets review, address verification and final two-wallet acceptance. [Incident response](../MAINNET_INCIDENT_RESPONSE.md) is documented but still requires assignment and rehearsal.
