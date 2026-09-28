# Mainnet incident response

Status: proposed runbook for rehearsal before launch. No independent external audit completed; mainnet release remains blocked. This document performs no operational action.

## Command, evidence and common rules

Assign an incident lead, Move reviewer, operations signer pair and communications owner before launch, with tested private contact/escalation channels and backups. The current repository does not establish a staffed on-call service. Declare an incident ID, record UTC timeline, network/chain ID, package addresses, release commit, transaction hashes/versions and all administrative actions. Preserve decoded payloads, VM status, events, relevant resource/table state, expected price/royalty/reimbursement, before/after ownership and APT balances, FeeStatement, provider responses and deployment hashes. Do not collect private keys, seed phrases or reusable credentials in reports.

Read through an independent RPC source before declaring state lost or a transaction failed. Separate principal transfers from gas/refunds. Do not automatically retry a pending/unknown transaction or delete a journal lock while an operator process may still be active. Stop harmful frontend actions without implying that UI disabling pauses the chain.

Current controls: `marketplace_fee_policy::set_global_paused`, `set_v1_paused`, `set_v2_paused`; launchpad `fee_policy::set_paused`; launchpad per-drop `set_admin_paused` and creator `set_creator_paused`. Global/adapter marketplace pause stops LIST/BUY, **not CANCEL**. There is no per-collection marketplace purchase pause or generic rescue/seizure entry point. V2 registry revoke only stops new listings. Every pause transaction requires the configured admin signer; under the proposal, that is the appropriate multisig quorum.

Maintain verified direct-chain cancellation instructions, exact package address and a trusted read/simulation route independent of the main frontend. Their implementation and rehearsal are release gates. Seller cancellation should remain available whenever the underlying transfer is technically safe. No procedure can promise recovery of an NFT already moved by an external capability or locked by changed framework/token behavior.

## Suspected custody bug

Pause the affected standard's LIST/BUY, or all marketplace activity if scope is unknown; pause launchpad mint/preparation/finalization if its capability path is involved. Keep reads and seller CANCEL available if reviewer analysis/simulation indicates it returns the exact asset safely. Pause flags cannot disable CANCEL: if cancellation itself is suspect, publish a warning and remove unsafe UI actions, but disclose that the chain path remains callable. Do not promise an admin rescue.

Collect exact listing/escrow identity, owner, capability provenance, package bytecode/policy, triggering transaction and reproduction. Establish whether the asset is still in custody. With immutable code, remediation is a reviewed replacement package and voluntary cancellation/relisting where possible. With compatible code, only audited governance-approved remediation under the upgrade policy is allowed; incident urgency is not authority to publish an unreviewed sweep. Reopen after cause, fix/mitigation, negative tests and independent verification are recorded.

## Settlement accounting anomaly

Pause affected LIST/BUY; pause mint if primary split is affected. Keep cancellation available: it makes no buyer reimbursement transfer. Collect stored fee/royalty/reimbursement snapshots, recipient configuration at execution version, actual transfers, event allocation, recipient aliases and gas/refund statement. Check `gross = fee + royalty + seller proceeds` separately from reimbursement and gas. A storage refund mismatch is not automatically a gross-conservation failure.

Reconcile on chain, identify whether code, display, projection or reimbursement calibration caused the discrepancy. Configuration changes affect future snapshots; existing listings may need seller cancellation/relisting. Do not rewrite historical records or promise automatic refunds. Resume after corrected evidence and acceptance tests, with a separate authorized compensation process if needed.

## RPC/indexer outage

Disable actions when authoritative state cannot be read or transaction status cannot be reconciled. Indexer-only failure does not require a chain pause if independent direct-chain reads remain reliable; otherwise on-call quorum may pause new economic activity. Preserve direct cancellation through a working trusted RPC. There is no contract dependency on PostgreSQL/indexer to cancel or settle.

Record endpoint, chain ID, ledger freshness, checkpoint, missed versions, errors and pending hashes. Fail over to verified RPC, resume worker from last verified checkpoint with idempotent events, replay missing history and compare chain ownership/status before restoring UI. Never derive transaction failure from indexer absence or roll back a checkpoint without evidence.

## Frontend compromise

Take the compromised deployment out of service, revoke its deployment credentials and pause marketplace LIST/BUY plus launchpad mint if signatures may be maliciously solicited. Keep verified cancellation via a clean independent interface or supported CLI/wallet path; do not redirect users through the compromised site. Already minted holder NFTs remain transferable subject to their native rules.

Preserve deployed bundle hashes, DNS/config change history, logs, wallet payloads and committed hashes; do not ask users for seeds. Restore from a verified reviewed commit with credential rotation and independent payload/network validation. Determine whether users signed unrelated transfers: VEYTOS pause cannot undo those. Reopen only after compromise scope and package/admin state are independently checked.

## Admin key compromise

If uncompromised quorum remains, pause using trusted signers, rotate member keys and execute current contract two-step admin succession as appropriate. Rotate future treasury recipient if necessary. Operational admin cannot rotate the publisher account by `propose_admin`; handle publisher compromise separately. If the attacker controls the whole admin signer/quorum, there is no emergency override in current contracts, and they can unpause or re-nominate. Do not claim guaranteed containment.

Cancellation remains available under operational pause; compromised V2 approval may make underlying assets unsafe. Collect signer-set/account authentication history, proposals/acceptance, fee/recipient/pause/registry events and publication history. Revoke unsafe collection approvals if control remains, but also pause V2 purchases. A compromised compatible publisher is a custody incident even with healthy admin multisig. Immutable code cannot be upgraded as a recovery shortcut. Escalate user exit guidance and a reviewed replacement if control cannot be restored.

## V2 collection provenance problem

Revoke the collection with `marketplace::set_v2_collection_reviewed(..., reviewed=false)` and pause V2 (or global) LIST/BUY if existing escrow is exposed. **Revocation alone does not stop BUY.** Current contracts cannot pause purchases for only one collection. Keep seller cancel available if the exact token remains owned by escrow and transfer is permitted; simulate against current state. If a creator capability already moved or locked it, cancel may abort and there is no generic recovery API.

Collect canonical collection/token, reviewed dossier, retained capability evidence, creator package upgrade history and before/after ownership. Correct provenance, exclude unsafe configurations and arrange creator-assisted recovery only if independently verified and separately authorized. Resume V2 after auditing remaining active escrows and registry entries.

## Malformed legacy V1 collection

Pause V1 LIST/BUY if the defect affects safety or availability; an isolated invalid listing that simply aborts may need exclusion/documentation rather than a global halt. Keep CANCEL available for valid stored linear tokens; direct-transfer opt-in is not required because authenticated signer deposit is used. No recovery promise applies to framework-level failures.

Collect full TokenId including property_version, TokenData maximum/supply/mutability/royalty/default properties, seller TokenStore balance, exact abort module/code and any known delegation history. Missing/malformed state fails closed. Outstanding WithdrawCapability values are not enumerable and can revive after return to their recorded owner. Recovery is per-token validation, native framework review, corrected support policy and holder education; do not infer collection-wide compatibility from one fixture.

## Transaction confirmation ambiguity

Stop automatic resubmission and keep a visible pending/unknown state. Chain pause is unnecessary for one RPC ambiguity unless there is broader unreliable-state risk. If chain confirms ACTIVE and seller is authenticated, cancellation can still be considered; it may race a pending buy, so never promise that both can succeed.

Record transaction hash, sender sequence number, expiration, submission time, network and responses without publishing signed transaction bytes. Query hash and committed state through independent RPC; distinguish committed success, committed abort, pending and still unknown. Only after explicit reconciliation of expiration/sequence and ledger evidence should an operator create a new attempt. Reconcile by network/package/listing/version/event index and direct custody. Successful BUY/CANCEL terminal state prevents a second sale; another transaction can still spend gas.

## Reopening criteria

Incident lead and independent technical reviewer sign off on cause, affected users/assets, remediation, state reconciliation and preserved evidence. Relevant multisig executes unpause only after focused regression/acceptance checks. Notify users of verified scope, limits and safe recovery steps; keep exploitable details private during containment. Conduct a rehearsal for each scenario before release and retain its evidence under the release gate.
