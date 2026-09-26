# Mainnet upgrade policy decision

Status: technical recommendation, not an executed decision. Both Move.toml files remain `compatible`; no publishing, freezing or key change was performed.

## A. Immutable at mainnet launch — recommended

Custody risk: removes VEYTOS publisher's ability to replace custody logic after publication. Framework governance and external collection capabilities remain. Bug fixes: cannot patch the deployed package; a new address/package and voluntary user cancellation/migration are required, and a bug can obstruct that exit. User trust: strongest verifiable package-level commitment. Operations: requires complete review, release rehearsal and a credible replacement/exit procedure before value arrives. Audit: review exact release source/bytecode, immutable metadata, dependencies and initialization parameters; a later replacement requires a new review.

## B. Limited compatible beta, then immutable

Custody risk: publisher can change logic throughout beta, including exposing private escrow/drop authority. “Limited” is not enforced by a date in these contracts. Bug fixes: compatible patches possible within layout/API restrictions; incompatible migrations still require another design. Trust: requires explicit beta risk disclosure, exposure limits and a deadline, with public verification of the final freeze. Operations: two release ceremonies plus maintaining cold quorum and notice/exit procedure. Audit: initial review plus every upgrade diff and final frozen artifact. A missed freeze deadline must stop new exposure; it must not silently become permanent upgradeability.

## C. Permanently compatible through multisig

Custody risk: persistent governance capture/key compromise can affect all escrow; quorum reduces single-key risk but does not remove malicious-upgrade authority. Bug fixes: ongoing compatible patches; no arbitrary resource-layout migration. Trust: users continually trust signer set, replacement rules and upgrade process. Operations: permanent key custody, incident response, signer turnover and monitoring, preferably enforced delay only after separately reviewing its implementation. Audit: continuous change review; original report no longer covers unreviewed upgrades.

## Recommendation and rationale

Choose A for mainnet after external review and public testnet beta. The current application can conduct its public beta on testnet; mainnet custody need not acquire temporary upgrade trust just to complete testing. Do not freeze now: unresolved audit and release gates remain. If business requirements later require a mainnet beta, choose B explicitly with a documented end date, exposure policy, governance threshold and re-audit/freeze acceptance; do not describe procedural promises as on-chain enforcement. Do not choose C by default for a custody system.

## Exact later enforcement procedure for A

1. Approve a release commit and signer/address plan; resolve external findings, framework/API compatibility, storage economics and release gates. Record both manifest pins and CLI version. Independently confirm production package addresses; development `0xcafe`/`0xbeef` are not production addresses.
2. In a separate reviewed release change, set `upgrade_policy = "immutable"` in both `move/launchpad/Move.toml` and `move/marketplace/Move.toml`. Keep package names/named-address substitutions fixed and review dependency policies. This phase does not make that edit.
3. Rebuild both with real address substitutions (without `--dev`), archive metadata BCS, module bytecode and SHA-256 digests, run all checks, and rehearse publication/initialization using equivalent disposable accounts on testnet. Inspect metadata policy, do not rely on the manifest alone.
4. Prepare an address-publication transaction calling `0x1::code::publish_package_txn(metadata_serialized, code)` for each approved publisher account through the selected governance signing system. Verify exact decoded payload/module addresses and artifact hashes with two independent reviewers. Simulate/review the target network transaction; obtain explicit release authorization through the release process. No placeholder addresses or executable mainnet commands are supplied here.
5. Once authorized in that later release, execute publication and reconcile committed hashes. Read each publisher's `0x1::code::PackageRegistry`, locate `MintosLaunchpad`/`VeytosMarketplace`, verify `upgrade_policy.policy == 2`, complete module set and bytecode digests against approved artifacts using independent RPC reads. Archive transactions, chain ID and ledger versions. Verify initialization/admin/treasury separately; immutable code does not configure operational policy.
6. On disposable testnet, demonstrate that a second publish to that immutable package aborts. Never test this by sending an exploratory mainnet transaction. Publish verified metadata/hashes and complete two-wallet acceptance before opening activity.

## If B is selected instead

Publish `compatible` with reviewed cold governance and beta disclosures. At the approved deadline, pause list/buy and mint, retain safe cancellation, audit the final code and repeat steps 2–6 using the **same package name/address and full compatible module set**, with immutable metadata in the final publication. Verify policy 2 after commit before claiming the publisher upgrade route is removed. Snapshot active obligations first; freezing is not an escrow migration. No key destruction or admin transfer substitutes for this metadata transition.

## Framework evidence and limitations

Pinned `aptos-framework/sources/code.move` defines policies arbitrary=0, compatible=1, immutable=2; `can_change_upgrade_policy_to` only permits strengthening, and `check_upgradability` rejects upgrading an already immutable package. Dependency checks constrain non-system package policies; system addresses are exempt, so VEYTOS immutability does not freeze Aptos.

Source: [pinned code.move](https://github.com/aptos-labs/aptos-core/blob/831c39cff4c5a8ead98ddffe0edfc4ba51623e91/aptos-move/framework/aptos-framework/sources/code.move). Reviewed from the local pinned dependency checkout. The package uses address publication in existing acceptance evidence; `freeze_code_object` is for object-code deployment and must not be blindly applied to this model. Reconfirm actual mainnet framework rules and multisig publication tooling in the later release rehearsal.
