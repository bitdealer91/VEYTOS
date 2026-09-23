# Contract acceptance tests

Phase 1A now has 82 passing Move tests across fee policy and launchpad behavior.
Gate A real testnet acceptance passed; see [the evidence](../TESTNET_ACCEPTANCE.md).
The lists below remain the review/coverage plan; the executable tests and recorded
receipts are the authority for which exact cases ran. Browser tests remain pending.

## Fee policy

- Initialize only with package signer, exactly once, with a nonzero recipient.
- Default is 500 bps; update supports 0..1000 bps, rejects 1001.
- Unknown signer cannot update fees, recipient or pause.
- Nonzero recipient rotation and authenticated pause/unpause work.
- Two-step admin handover: proposal alone does not transfer authority; only nominee
  accepts; old admin loses access; zero nominee/unauthorized proposal rejected.
- Amount conservation, deterministic per-token rounding, zero-price mint,
  zero-fee configuration, largest u64 price and total overflow.
- Verify module events contain accurate old/new values and recipients.

## Collection lifecycle and metadata

- Prepare/finalize creates a real native Digital Asset collection and royalties.
- Reject zero/oversized supply, invalid limits, past/invalid timing, royalty >100%,
  oversized UTF-8 fields and non-IPFS metadata references.
- Reject finalize without all metadata, duplicate/missing indices, oversized chunks,
  wrong offset, unauthorized append/finalize, repeated finalize, append after freeze.
- Discard mutation and transfer capabilities; test external creator calls to native
  token mint APIs cannot mint into the protected collection.
- Human creator attribution is correct despite the authority object being the native
  collection creator. Collection and authority objects cannot be transferred away.

## Mint economics and ownership

- Buyer pays exact total, treasury receives correct per-token fee, creator receives
  remainder; buyer owns each native token and tokens reference the right collection.
- Free mint follows identical cap/counter rules; no payment call required for zero.
- Fail one second before start; succeed at start; fail at exact end and after end.
- Last available NFT succeeds, next fails, oversubscribed batch fails atomically.
- Lifetime per-wallet limit holds across transactions and NFT transfers.
- Transaction quantity 0 or above limit fails; integer multiplication cannot wrap.
- Bad price expectation or total ceiling fails without changing balances/counters.
- Insufficient APT or framework mint failure rolls back payments, counters and NFTs.
- Global pause, creator pause and admin pause each block minting; one authority
  cannot clear another's pause. Owners can transfer already-minted NFTs while paused.
- Existing drops retain their snapshotted fee after admin changes; treasury rotation
  affects the destination without changing creator revenue.
- Collection supply, lifetime minted and per-wallet counts agree with emitted tokens.
- No user-provided signer, payout address or royalty override can bypass policy.
- Same buyer=creator or buyer=treasury and creator=treasury are accounted correctly.

## Testnet acceptance and remaining browser evidence

Record network/chain ID, package address and source hash, dependency pin, deployment
version, creator and distinct buyer addresses, create/mint hashes, DA token addresses,
before/after balances (separate buyer gas), royalty resources and owner verification.
Gate A records the contract checks above. Phase 1C must additionally cover Petra
desktop, mobile handoff and Aptos Connect; failures/rejections, wallet
network switching, slow confirmations, indexer delay and session replay attempts.

Do not count unit-test signers, fixtures, dry runs or fabricated hashes as testnet
acceptance. Mainnet remains blocked until all required evidence is recorded.
