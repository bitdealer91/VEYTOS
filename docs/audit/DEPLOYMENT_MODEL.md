# Deployment and operational model

This is preparation only. Phase 3B is blocked on external accounts/credentials. No provider provisioning, deployment, publication, mainnet transaction, package policy change or custody change is authorized by this package.

## Current baseline

Audit branch starts at verified main `d77a27b`, not deployment experiment `c03b37b`. The clean baseline passed 82+100 Move, 71 Node and 57 frontend tests, typecheck, production build and diff check. Production sources are six Move modules in two compatible packages; named addresses are unresolved `_` outside dev mode. No mainnet address is assigned by this document.

Address-published launchpad and marketplace packages initialize independent fee configs and private state. Marketplace initialization includes shared State and both adapter Escrows. Initialization is publisher-only and single-use. Setting operational admin with propose/accept does not relinquish publisher upgrades. Cold publisher control and operational rotation are separate ceremonies.

## Proposed production components

- Aptos packages: exact independently reviewed artifacts, pins, metadata, module addresses and signer provenance. Proposed immutable policy at first mainnet publication; see MAINNET_UPGRADE_POLICY.
- Browser frontend: wallet-owned signing; verified network/package configuration, direct-chain preflight and committed-hash reconciliation. It is not the custody authority.
- Production RPC: explicitly configured target network, availability and independent verification path. Read/simulation evidence is required; no secrets in browser configuration beyond intentionally public values.
- Indexer worker and PostgreSQL: replayable event projection, idempotent event keys, checkpoint integrity, migrations/backups and monitored lag. A projection never authorizes a trade.
- Storage/content services: independent availability and content validation; URI syntax checks in Move do not validate hosted content.

Operator signer domains, proposed thresholds, rotation and pause are in PRIVILEGED_ROLES. Native multisig execution and publishing workflows must be tested with supported account tooling before mainnet; this document does not assume a browser's multisig UI guarantees the correct signer or decoded payload.

## Release artifacts required later

Record release commit, lockfile digest, toolchain versions, both framework pins, clean build commands, module/metadata hashes, named-address substitutions, target chain ID, PackageRegistry policies, approved operational admin/treasury addresses, collection registry dossiers, publication/initialization/config transactions and committed ledger versions. Verify from two independent sources and retain a human-readable decoded payload record. Never put private keys, mnemonics, credentials or signed pending transaction bytes in the audit package.

Historical testnet evidence is listed in AUDIT_HANDOFF. Its package/address/digest must be compared with release artifacts; earlier success does not prove the final release bytecode or multisig configuration. The final gate remains closed until docs/MAINNET_RELEASE_GATE.md is satisfied.
