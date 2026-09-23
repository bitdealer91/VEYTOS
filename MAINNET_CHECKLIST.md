# Mainnet release gate

Gate A testnet contract evidence is complete. The checked items below apply only
to the recorded testnet build and must be repeated for the final release candidate.
Mainnet remains blocked. This checklist does not authorize deployment.

- [ ] Full Phase 1 creator → launch → independent buyer mint works on testnet.
- [x] Gate A operator/SDK testnet flow: creator launches, distinct buyer owns two
  NFTs, counters/events and exact 5% settlement verified; [evidence](TESTNET_ACCEPTANCE.md).
- [x] Current Move suite: 82 passing tests, native DA ownership and atomic payments.
- [x] Current TypeScript validation: 13 passing tests and type checking including scripts.
- [ ] Web production build, core browser tests and mobile wallet tests pass.
- [x] Testnet record identifies source digest, dependency pin, published bytecode
  hashes, package address and deployment transaction/version.
- [x] Native framework APIs used by the package exercised on testnet chain ID 2.
- [ ] Native framework APIs/features reverified for the intended mainnet release.
- [ ] External contract security review completed and findings resolved.
- [ ] No capability escape, admin NFT seizure or post-launch supply/metadata changes.
- [ ] Mainnet package upgrade policy is immutable and independently verified.
- [ ] Multisig admin, successor procedure and treasury address verified by operators.
- [x] Current code/tests: initial fee 500 bps, maximum 1000 bps, snapshot policy
  documented; testnet settlement verified at 5%.
- [ ] Mainnet initial fee, treasury, admin and fee cap independently verified.
- [ ] On-chain royalties displayed accurately; enforcement limitations disclosed.
- [ ] Real gas/storage benchmarks establish supply/chunk/quantity limits.
- [ ] IPFS pin retention, retrieval verification and provider recovery tested.
- [ ] SIWA replay, CSRF, session and role boundaries tested with supported wallets.
- [ ] Database migrations, backups, restore and worker replay tested on PostgreSQL.
- [ ] Indexer chain/module validation, lag alarms and duplicate handling tested.
- [ ] Reports, moderation audit trail and verification language reviewed.
- [ ] Environment configuration, network checks and public origins verified.
- [ ] Repository secret scan and runtime dependency audit clean or reviewed.
- [ ] Production error monitoring and incident pause runbook rehearsed.
- [ ] Public security contact established.
- [ ] Final testnet evidence attached, deployment owner reviews release checklist.
- [ ] Mainnet publication explicitly approved, executed and independently verified.

Gate A does not include public IPFS availability, browser wallets, discovery or
mainnet approval. Phase 1B / Gate B discovery is next; Phase 1C / Gate C UI follows.
No Phase 2 implementation before Phase 1 acceptance and compatibility research.
