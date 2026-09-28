# Trust model

Status: internal preparation; no independent external audit completed. Mainnet remains blocked.

## On-chain trust

**Marketplace package.** Users trust the six-module review boundary described in AUDIT_SCOPE (four marketplace modules plus two launchpad modules when minting VEYTOS assets). Only adapters bind native custody to the shared lifecycle. Shared package-visible functions trust other package modules; they do not independently prove custody. No external module may construct arbitrary listing identities or settle them. Compatible upgrades can add a malicious package module or change existing behavior while preserving signatures/layouts. Operational admin restrictions do not constrain publisher upgrades.

**Launchpad package.** The private drop ExtendRef can create native assets through the checked mint path. Users depend on supply, counters, immutable terms and constructor-capability disposal. The native creator is the drop address, not necessarily the human creator wallet. An upgrade could expose the retained authority. Treasury rotation intentionally changes the destination of future primary fee payments even for existing drops; the rate stays snapshotted.

**Aptos framework and VM.** Trust signer authentication, linear resources, object ownership/capability semantics, Token V1 withdraw/deposit, APT transfer, tables, timestamps, arithmetic and transaction rollback. Framework governance can change system modules even when VEYTOS is immutable. The two build pins are reproducibility inputs, not a guarantee mainnet executes those exact implementations. Verify target network ABIs, features and behavior before release. No Move unit test establishes validator storage-refund pricing or network liveness.

## Operational trust

- **Admin:** can pause new economic activity, change future fee rates/reimbursement within caps, rotate treasury and transfer admin. Marketplace registry shares this same admin; roles are not independently permissioned in current contracts. Admin can deny service or approve unsafe collections, but has no current direct seizure API.
- **Treasury:** controls fees already received. A compromised treasury loses those funds; it cannot authorize a trade or mint. Current admin can redirect future fees but cannot claw back previous transfers.
- **Reviewed V2 collection authority:** review must establish canonical identity and retained transfer/burn/mutation capabilities from deployed creator code and publication history. A reviewed bit/provenance enum is an administrative assertion, not a cryptographic proof. Retained TransferRef can defeat escrow; revocation alone does not block existing BUY.
- **RPC provider:** availability, freshness, correct network and truthful responses matter to user decisions and transaction reconciliation. Provider output cannot grant on-chain custody, but a deceptive provider/UI can induce a user to sign harmful arguments. Check chain ID, versions and committed hashes with an independent provider for release/incident evidence.
- **Indexer/database:** discovery, ordering, moderation and history projections only. Database/indexer is NOT authoritative for trading authorization. Stale or forged rows must not authorize custody or treat an unknown transaction as failed.
- **Frontend:** frontend is NOT authoritative. It constructs requests, displays snapshots, requests wallet signatures and reconciles outcomes. Frontend compromise can phish users or substitute payloads; Move only enforces its own entry points, not arbitrary wallet transactions the user signs.

**Direct-chain state authorizes LIST/CANCEL/BUY:** LIST requires signer ownership and actual custody transfer; CANCEL requires recorded seller and ACTIVE escrow; BUY requires ACTIVE escrow, exact expected price/reimbursement, valid signer and successful payment/delivery. UI visibility and moderation do not revoke on-chain rights. A separate trusted read/simulation path and verified entry addresses are needed if the normal frontend is unavailable.

## Adversaries and assumptions

Consider malicious buyer/seller/creator, third-party capability holder, compromised admin/treasury/publisher, fraudulent collection approval, stale RPC and poisoned projection, hostile metadata and racing transactions. A wallet limit is per address, not per human. Third-party Token V1 maximum can change after listing; acceptance checks do not promise permanent scarcity. V1 delegated withdrawal can act when an exact TokenId returns to the delegated owner's TokenStore. V2 delivery may fail if an external capability moves or restricts the token after listing. In either case no generic admin rescue is promised.

Contract gross conservation concerns the transfers specified by settlement. Gas, refunds, self-recipient aliases and sponsored transaction economics require separate balance interpretation. IPFS URI syntax does not establish metadata availability, safety or immutable external content unless content-addressed and correctly resolved.
