# Mainnet release gate

**BLOCKED.** No independent external audit completed. This checklist is a future release authorization record, not a deployment instruction. Phase 3B provider work remains paused. An unchecked gate cannot be waived by a passing unit-test total or a production build.

For each gate record owner, evidence link, reviewed commit/address, date and independent approver. All boxes are intentionally unchecked; document creation alone does not prove operational implementation.

- [ ] Independent external Move security review completed for exact release scope, pins and artifacts — security lead; signed report and reviewed commit.
- [ ] Findings resolved and auditor retest accepted; residual risks explicitly approved — security/release leads; finding-to-fix/test ledger.
- [ ] Admin/multisig policy implemented and rehearsed — operations/security; signer separation, thresholds, backups, propose/accept and old-admin rejection evidence. No single hot browser wallet controls all mainnet authorities.
- [ ] Upgrade policy finalized and enforced for both packages — governance/security; decoded payloads, PackageRegistry and independently verified bytecode/policy. Recommendation is immutable at launch; manifests are still compatible today.
- [ ] Production RPC provisioned and validated, with independent verification/failover — operations; chain-ID, freshness and outage test.
- [ ] Production indexer/database provisioned, migrations/backups/checkpoint replay/lag monitoring validated — operations; service and restore evidence.
- [ ] Public beta completed on the intended beta network — product/security; tested release, scope and defects ledger.
- [ ] Real external beta users tested both standards and mint/recovery flows — product; consented feedback and reconciled transactions, not only internal operator wallets.
- [ ] Incident response documented, assigned, rehearsed and cancellation route available independently of frontend — security/operations; scenario drills and signed review of MAINNET_INCIDENT_RESPONSE.
- [ ] Secrets review passed for repository/history, build artifacts, client configuration and operational logs — security; scoped tooling/results with no secrets copied into evidence.
- [ ] Mainnet package addresses independently verified against target chain, publisher, package metadata and approved artifacts — two release reviewers; full-address/digest evidence, not explorer label alone.
- [ ] Final two-wallet acceptance completed against approved release/configuration — independent operator pair; LIST/CANCEL/RELIST/BUY for V1/V2, launchpad mint, snapshots, balances, NFT identity, events and terminal replay evidence.
- [ ] Framework/VM ABI and feature compatibility confirmed for both pins and target network — Move reviewer; no silent dependency upgrades.
- [ ] V2 registry dossiers approved and current active escrow provenance reviewed — independent collection reviewer plus marketplace multisig.
- [ ] V1 per-token support checks and residual delegation/mutability disclosures reviewed — Move/product reviewers; no collection-wide compatibility promise.
- [ ] V1/V2 reimbursement calibrated separately against current validator FeeStatement and identity sizes/gas payer model — economics/security; V1 initialization default zero distinguished from configured acceptance value.
- [ ] Remaining coverage gaps triaged with auditor, including rollback, event fields, pause matrix, numerical boundaries and gas/state-growth tests — security; TEST_COVERAGE_MATRIX disposition.
- [ ] Reproducible clean build/test artifact bundle and dependency review complete — release engineer; commit, lockfile/toolchain/pins, module/metadata hashes and validation logs.
- [ ] Explicit release authorization recorded after all above evidence is independently reviewed — release owner and governance quorum.

External-audit intake can begin before provider deployment: freeze review commit, share scope/invariants/trust/coverage/evidence, identify private reporting channel and accountable finding owners, and agree review/remediation scope. Missing providers block production readiness, not source review. No audit engagement, signed report, production credential availability or completed external beta is asserted here.
