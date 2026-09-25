# VEYTOS Marketplace V2 testnet acceptance

Status: **Gate D-V2 passed and hardened V2 re-acceptance passed** on Aptos testnet on
2026-09-24. These results verify upgradeable development packages only. They are not
an audit or mainnet authorization.

## Package and compatibility

- Network: Aptos testnet, chain ID `2`
- Package address: `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28`
- Package: `VeytosMarketplace`, compatible upgrade policy, upgrade number `0`
- Framework pin: `831c39cff4c5a8ead98ddffe0edfc4ba51623e91`
- Deployment: `0xa2ef2a27ccccbe9cb25185e69d12aca83ddd870d84ac5ac98c96e43b0321c2d4`
- Published bytecode for `marketplace`, `marketplace_fee_policy` and
  `settlement_v2` matched the locally compiled artifacts at the deployment version.

Publishing, initialization, native Digital Asset reads, object custody, APT
settlement and view functions all executed against the live testnet framework. This
is the compatibility proof required beyond local compilation.

## Independent roles

- Admin/publisher: `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28`
- Seller: `0xc2c1bf1b5e5413aa466c7edd7fb196be10e052d949eb8056a61e2badd91d54d5`
- Buyer: `0x51223eb03eebd08713fee79d982ef98ab715094e90575451a9d7afcb12a40eb2`
- Treasury: `0xed6fc41816b13e2151a8e4a66c72247b7b927c264c84976bda91d918d23049aa`
- Royalty recipient: `0xdf06f553f91c6f861b1569da5b89d0c436fe3885310da962053386e678d972d9`

Only public addresses are recorded. Private keys remain in the existing owner-only
testnet account file outside the repository.

## Asset and collection policy

- VEYTOS collection: `0x287dea5ae1c96817a211877faf19b38d1884fb4a59305101db44fc32fb609e61`
- NFT: `0x9d7c6696d0aada3a845f38b91c1faa8d5c24568cefa79dee82a71d717155026e`
- Native royalty: `750 / 10,000` (7.5%)
- Collection approval: provenance class `1` (VEYTOS-launched), committed before listing

## Custody sequence

1. Seller owned the NFT.
2. First list transaction moved it to isolated escrow
   `0xcd32c764fd6d77d361363371df0284b8f982da22a2384d3274ee34bf2bc687de`.
3. Seller cancellation returned the exact NFT and terminally marked listing `1`
   `CANCELLED`. Treasury and royalty balances did not change.
4. Relisting created listing `2` and isolated escrow
   `0x26bb4b5541b627389d19de293b99210188d323444a1bbefcd50c038f72dc55e8`.
5. The independent buyer purchased listing `2`; the exact NFT moved to the buyer and
   the listing became `SOLD`.

Transactions:

- List: `0x2e40f801c60c3bbfb1dea489d8440206e5a6591df8e81d2271867ba91c673541`
- Cancel: `0x5edeb5764b3ff17579127ba839b317f638b61a89a3245235445359f9ba943853`
- Relist: `0x48efea78251713e026f61e0c190fbfd95ecf05b5d14b124a5716495da62467a7`
- Buy: `0x883a1bb6b2a51560d350ab999a8766220896abfd3e79b886249ca0dd6f0f436f`

The committed `NFTListed`, `ListingCancelled` and `NFTPurchased` module events match
the listing IDs, asset identity, participants and economics.

## Settlement conservation

For gross price `10,000,000` octas (0.1 APT):

```text
platform fee      200,000 octas  (2%)
royalty            750,000 octas  (7.5%)
seller proceeds  9,050,000 octas
total           10,000,000 octas
```

Ledger-version balance reads confirmed each recipient delta exactly. The buyer's
network-cost reconciliation also includes the Aptos `FeeStatement`: gross gas charge
was `510,800` octas and storage refund was `926,400` octas. The refund exceeded this
transaction's gross gas charge because purchase removed the escrow table entry.
Network storage refunds are separate from the conserved sale price.

## Evidence and limitations

Machine-readable receipts, bytecode hashes, events, ledger-version ownership and
balance evidence are in
[`docs/evidence/marketplace-v2-testnet.json`](evidence/marketplace-v2-testnet.json).

Remaining limitations:

- the testnet package is upgradeable and unaudited;
- V2 admission depends on the documented capability-provenance review;
- a creator-retained NFT `TransferRef` remains a standard-level risk for an
  incorrectly approved collection;
- the original Gate D package gives the buyer the seller-funded deletion refund and
  leaves sticky escrow shells; use the hardened package below for further development;
- no marketplace frontend actions exist; Token V1 acceptance is documented separately.

## Hardened V2 re-acceptance

The storage policy described in
[`docs/MARKETPLACE_STORAGE_ECONOMICS.md`](MARKETPLACE_STORAGE_ECONOMICS.md) changed
the listing layout and BUY arguments, so it was published at a fresh testnet address
and the complete acceptance sequence was repeated.

- Hardened package: `0x0cf2b5af2e168b4ba7f002f705e7f1c1954284756286167800e2b6b11ae6ab64`
- Deployment: `0x429c0aec4faea2e67f24de69f3444be03eba4e6b74f822852ed8cf0ba67c3db2`
- Seller: `0x51223eb03eebd08713fee79d982ef98ab715094e90575451a9d7afcb12a40eb2`
- Buyer: `0xc2c1bf1b5e5413aa466c7edd7fb196be10e052d949eb8056a61e2badd91d54d5`
- NFT: `0x9d7c6696d0aada3a845f38b91c1faa8d5c24568cefa79dee82a71d717155026e`
- List: `0xd9bf21289fddb5540ba204637499936135f5d08a6e950fb63d95a9e941eff906`
- Cancel: `0x331daa7162435815c084d078d9e0bc9f91988db7efc9de38603ab5460187e451`
- Relist: `0xbb6e9d1dadc7ff65a38a6e3a2be5e458e5df005908ad75ea93d4812d1b410c2b`
- Buy: `0x94db39676c8412c98be9ccc580ea880548a9105224784f2c3bb102f656e09e5a`

The hardened LIST storage charge was `1,433,600` octas, down from `1,944,000`.
No `ObjectCore` or other resource exists at either terminal escrow address. CANCEL
and BUY each deleted the same escrow and active-asset table entries and refunded
`926,400` octas to their transaction gas payer.

For BUY, the immutable listing snapshot required a `926,400` octa reimbursement:

```text
sale price                         10,000,000 octas
buyer -> seller reimbursement         926,400 octas
protocol -> buyer deletion refund      926,400 octas
buyer gross transaction charge          18,700 octas
buyer net outside sale price             18,700 octas
```

The seller received `9,050,000` octas of sale proceeds plus the `926,400` octa
reimbursement. Treasury still received exactly `200,000` octas, royalty recipient
received exactly `750,000` octas, and the sale-price conservation equation remained
unchanged. The final NFT owner is the independent buyer; listing `1` is `CANCELLED`
and listing `2` is `SOLD`.

Machine-readable hardened receipts, bytecode hashes, fee statements, ownership and
empty-escrow resource checks are in
[`docs/evidence/marketplace-v2-hardening-testnet.json`](evidence/marketplace-v2-hardening-testnet.json).

Hardened V2 classification: **READY FOR V1 TO BUILD ON**. The custody boundary,
shared lifecycle and sale-price economics remain stable. V1 must independently
calibrate and snapshot its own storage reimbursement because its custody value and
table-key sizes differ from V2.
