# Gate A — real Aptos testnet acceptance

**PASS — Phase 1A contract core, verified 2026-09-23.**
This is real signed testnet execution using three disposable SDK-controlled wallets.
It is not browser-wallet acceptance, an external audit or mainnet approval.

## Environment and deployment

- Network: Aptos testnet, chain ID **2**, official fullnode
  https://api.testnet.aptoslabs.com/v1 (the tool rejects endpoint/network drift).
- Package address: `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28`.
- Publication: [`0x8a2cb1e2f211d9519f88fad8a5e2566694e6d558026d4a5695968fe35e217506`](https://explorer.aptoslabs.com/txn/0x8a2cb1e2f211d9519f88fad8a5e2566694e6d558026d4a5695968fe35e217506/overview?network=testnet); ledger version **11370375847**.
- Package: MintosLaunchpad 0.0.1; published upgrade policy **compatible (1)**,
  upgrade number **0**. The publisher retains upgrade authority on this testnet package.
- CLI: **9.6.0**, TypeScript SDK: **7.3.0**, Node: **24.9.0**.
- Framework/AptosTokenObjects pin: `1b116b414ccc1d860fa72160d9b9a770e8d8e88f`.
- Operator source SHA-256: `e6b00c5a4f6103bce688c85bd1231ca6e1774a4914580996361265d6c82faf7a`.
  This hashes the Move manifest and sorted production source paths/bytes; it differs
  intentionally from the framework package source digest below.
- Published package source digest: `08BBB50C7E2AAE3F73F1234C796F00968874068C77EC90D2E588CC4AA6AEDB0E`.
- Published bytecode matched the freshly compiled production modules exactly:
  - fee_policy: SHA-256 `ade05e4acc53eda9fd721b0c93fd6b7bf17c2ae21562952e627a119d972da82b`.
  - launchpad: SHA-256 `1ddff3439657d5b75a359b75f2ea1da212bbda45b5387a6fa9861e97fada64d2`.

Compilation, publication and signed transactions exercised the actual testnet native
collection, token, object, royalty and APT transfer APIs. This does not prove all
APIs at the source pin are deployed, or establish mainnet compatibility. Compilation
uses the publisher's named address and excludes development/test modules.

## Wallet roles (addresses only)

- Admin/deployer: `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28`.
- Treasury: `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28` (same disposable account as admin for this test).
- Creator: `0xdf06f553f91c6f861b1569da5b89d0c436fe3885310da962053386e678d972d9`.
- Buyer: `0xc2c1bf1b5e5413aa466c7edd7fb196be10e052d949eb8056a61e2badd91d54d5`.

The three signing accounts are distinct. Treasury equals admin only in this operator
scenario; mainnet requires separately reviewed treasury/multisig configuration.
The original faucet funding transaction was
[0x9401f69f…16cc439](https://explorer.aptoslabs.com/txn/0x9401f69f369e89d308180b05d10fcff684446e5df25630759525a230416cc439/overview?network=testnet),
for 10 testnet APT. The deployer funded creator with 3 APT total and buyer with 1 APT.
Private keys were moved outside the repository into an owner-only operator file.
No keys, seed phrases or signed transaction bytes are included in public evidence.

## Creator lifecycle and buyer mint

- Prepare: [`0xd2028357799b917ed7ab480c3c32f1d238a11af347d4893f35bfb53788d1b986`](https://explorer.aptoslabs.com/txn/0xd2028357799b917ed7ab480c3c32f1d238a11af347d4893f35bfb53788d1b986/overview?network=testnet).
- Four successful metadata transactions register 25 entries each; all hashes and
  gas receipts are in [machine-readable evidence](docs/evidence/testnet-acceptance.json).
- Finalize/native collection creation: [`0x73a69de7bcf500af5754e0c8e3987d8de29bd24cd636504f97a3767c6a05ab8d`](https://explorer.aptoslabs.com/txn/0x73a69de7bcf500af5754e0c8e3987d8de29bd24cd636504f97a3767c6a05ab8d/overview?network=testnet).
- Mint two NFTs: [`0xba83fc58615f823a51deb52717a0c1426a85ac79ba6a528f8b018e5099016d7d`](https://explorer.aptoslabs.com/txn/0xba83fc58615f823a51deb52717a0c1426a85ac79ba6a528f8b018e5099016d7d/overview?network=testnet); version **11370403456**.
- Drop/authority address: `0xa9ff8a00fda26cbb50c1b32ac198fe8f1c8128587f7ec822a9202cd2c8600e3`.
- Native collection address: `0x287dea5ae1c96817a211877faf19b38d1884fb4a59305101db44fc32fb609e61`.
- Name: Gate A acceptance; supply **100**; price **0.1 APT** each.
- Wallet lifetime limit **10**; transaction limit **5**; start timestamp
  **1790180342** (2026-09-23T16:19:02.000Z); no end time.
- Snapshotted primary fee **500 bps (5%)**; native royalty **750/10000 (7.5%)**
  payable to the creator. Royalties are recorded for later secondary activity,
  not charged in addition to the primary split.
- Collection URI: `ipfs://bafkreiblmldnffjlohwygjwcir4docspibogmkady7wqvy57kjqt7pxjxq`.

Verified from native Token and ObjectCore resources at the mint's ledger version:

- Gate A #1, token object `0x9d7c6696d0aada3a845f38b91c1faa8d5c24568cefa79dee82a71d717155026e`.
  Owner: buyer address above; collection: native collection above.
  Metadata: `ipfs://bafkreictkgbn5ugu4bdg3nmgqkarigdml74iafgu4h5denh3b6d7wemd6q`.
- Gate A #2, token object `0x1a7f1b695ac25dd538135b526729fbf504ed7187215fbb0ebfd5d53c2b862a9`.
  Owner: buyer address above; collection: native collection above.
  Metadata: `ipfs://bafkreieqxj2pm5oii5uj7wqwzb6p4zbhf2ux6moidz4xzrulyfaero2pvm`.

The native collection creator is the private authority object, not the human wallet.
The human creator is recorded in immutable drop terms, royalty payee and mint events.
Native collection count is **2**. Launchpad progress is **[100 uploaded, 2 minted,
100 maximum]**, leaving **98**. Buyer lifetime mint count is **2**. Exactly two
canonical NFTMinted module events name the expected buyer, creator and treasury,
with serials 1 and 2 and correct fee/proceeds. Actual native ownership was verified;
no database ownership records or indexer assumptions were used.

## Expected versus actual settlement

All comparisons use integer octas at ledger versions **11370403455**
and **11370403456**, isolating mint execution from funding and creator gas.
Balance arrays in JSON are ordered **buyer, creator, treasury**.

- Gross expected: 2 × 10,000,000 = **20,000,000 octas (0.2 APT)**.
- Fee per NFT: floor(10,000,000 × 500 / 10,000) = **500,000 octas**.
- Treasury expected **1,000,000 octas (0.01 APT)**; actual balance
  **590685900 → 591685900**, delta **1,000,000**. PASS.
- Creator expected **19,000,000 octas (0.19 APT)**; actual balance
  **146857700 → 165857700**, delta **19,000,000**. PASS.
- Buyer actual balance **100000000 → 77815700**; debit **22,184,300 octas**,
  exactly gross plus **2,184,300 octas (0.021843 APT)** gas/storage charge.
  Receipt: 21,843 gas units × 100 octas. PASS.

Each mint event records 500,000 fee + 9,500,000 creator proceeds = 10,000,000 octas.
Creator receives 95% with no sale funds retained in the package.

## Negative transaction and recovery evidence

Max-total protection: [`0x38bf4627d1612ea35bfb992095aed0151b7718ef032a25f669bba1120ab5c9a9`](https://explorer.aptoslabs.com/txn/0x38bf4627d1612ea35bfb992095aed0151b7718ef032a25f669bba1120ab5c9a9/overview?network=testnet), version
**11370404040**, committed abort **EMAX_TOTAL (15 / 0xf)**.
Creator/treasury balances and mint counters stayed unchanged; no NFTMinted events
were emitted. Buyer paid only **7,300 octas** gas (73 × 100).

A complete second run reconciled the same publication, creation and mint hashes.
It passed again with exactly two NFTs and two lifetime mints; it created no second
mint or duplicate funding. Unknown results are not treated as failure.

Deviations discovered and resolved:

1. SDK 7.3.0 ledger-version options require bigint. Three initial TypeScript errors
   were fixed with lossless BigInt conversion. Scripts now participate in normal tsc.
2. CLI 9.6.0 with --output-dir writes metadata separately from bytecode. Two local
   attempts stopped before signing. The final flow stages only production sources
   and compiles without this override, keeping publication artifacts together.
3. Initial metadata upload [`0x96c3b8f1213ef72e77c802dcc0ffc509c8364248128a009b9e44f83968817c20`](https://explorer.aptoslabs.com/txn/0x96c3b8f1213ef72e77c802dcc0ffc509c8364248128a009b9e44f83968817c20/overview?network=testnet) committed an
   out-of-gas abort at version **11370377242** with a **200,000** gas-unit cap.
   It charged **20,000,000 octas (0.2 APT)** and left progress **[0, 0, 100]**.
   The exact abort and rollback were read from chain before archiving that journal
   entry and creating a new attempt. The creator received 2 additional APT for
   storage; entry transactions now allow 500,000 gas units and simulate expected
   successes before signing. Successful 25-entry uploads consumed **327,122–327,202**
   gas units each at 100 octas. This is a real storage-cost finding, not a contract
   logic change. Maximum-limit benchmarking remains incomplete.

## Running and resuming

Use the commands and documented environment inputs in [README.md](README.md).
The external account file must use an absolute path, mode 0600, and resolve outside
this repository. No implicit CLI profile is loaded. Preflight checks chain, accounts,
package address and admin funding; the deployment path runs all existing tests first.

The ignored .testnet journal durably stores signed bytes and hashes before sending.
On resumption, HTTP 200 means reconcile the known transaction; HTTP 404 permits only
re-sending identical bytes. Other lookup errors stop the run. Timeouts are unknown.
Do not delete the journal, re-sign, or assume a transaction failed because an RPC
request failed. Expired/failed transactions require operator reconciliation first:
verify the committed result (or prove non-execution), preserve the original receipt,
inspect relevant chain state, then deliberately stage a separately signed attempt.
The script does not automatically replace committed failures. A run lock blocks
concurrent execution; remove a stale lock only after its process is gone and all
pending hashes have been reconciled. A new independent run needs fresh identities
and a separate journal, not a reset against the same already-published address.

## Validation and scope limits

- **82/82 Move tests passed**, production Move compile passed.
- **13/13 TypeScript tests passed**, normal type checking passed including scripts.
- Project scan found no disposable key bytes or private-key format matches in
  150 non-dependency/non-build files; external account file permissions are 0600.
  This workspace has no Git metadata, so no tracked-file or history claim is made.
- [Validation log](docs/evidence/gate-a-validation.txt).
- [Native resources, events, receipts and balance evidence](docs/evidence/testnet-acceptance.json).
- Metadata/image fixtures use real content hashes and validate as a 100-item manifest,
  but bytes are stored only in ignored .testnet/metadata. No public IPFS pinning or
  gateway availability is claimed. Supply 100 / mint quantity 2 were exercised.
- No browser, wallet-adapter, marketplace, legacy compatibility or database work
  was performed. Generated database migrations remain unapplied.
- Compatible upgrades, disposable admin, absent external review, full-limit gas
  benchmarks and missing product/storage/security gates block mainnet.
- **No remaining Gate A blocker before Phase 1B.** Next work is real Token V1/V2
  collection compatibility research and verified wallet NFT discovery, not frontend.
