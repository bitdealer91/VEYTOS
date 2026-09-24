# VEYTOS Marketplace Token V1 testnet acceptance

Status: **Gate D-V1 passed** on Aptos testnet on 2026-09-24. This proves the
upgradeable development package and representative legacy-token behavior. It is not an audit or
mainnet authorization.

## Package and roles

- Network: Aptos testnet, chain ID `2`
- Package: `0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb`
- Deployment: `0xe0fe87db7f7d0f5d5aee0ace7138b7e2c51c1cde566217a0de03817cdedf6d4b`
- Framework pin: `831c39cff4c5a8ead98ddffe0edfc4ba51623e91`
- Admin/publisher: `0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb`
- Seller/creator: `0x51223eb03eebd08713fee79d982ef98ab715094e90575451a9d7afcb12a40eb2`
- Buyer: `0xc2c1bf1b5e5413aa466c7edd7fb196be10e052d949eb8056a61e2badd91d54d5`
- Treasury: `0xed6fc41816b13e2151a8e4a66c72247b7b927c264c84976bda91d918d23049aa`
- Royalty recipient: `0xdf06f553f91c6f861b1569da5b89d0c436fe3885310da962053386e678d972d9`

Only public addresses are stored in the repository. Disposable private keys remain in the
owner-only acceptance account file outside the checkout.

## Representative legacy asset

Token V1 has a structured identity rather than an object address:

- creator: `0x51223eb03eebd08713fee79d982ef98ab715094e90575451a9d7afcb12a40eb2`
- collection: `VEYTOS V1 Gate D`
- token name: `Legacy Property NFT #1`
- property version: `1`
- maximum: `1`
- royalty: `750 / 10,000` to the independent royalty recipient

The token was created at property version `0`, mutated through the framework's property path to
version `1`, and then used for the full acceptance lifecycle. No mainnet or valuable historical
asset was transacted.

## Lifecycle proof

1. The seller owned exactly one matching property-version asset.
2. LIST withdrew that exact linear `Token` into private module custody. The seller balance became
   zero and the escrow row existed.
3. CANCEL returned the exact token to the seller and terminally set listing `1` to `CANCELLED`.
4. The measured `926,400` octa deletion refund was configured as the independent V1 storage
   reimbursement.
5. RELIST escrowed the same exact asset as listing `2` with the reimbursement snapshotted.
6. BUY delivered the exact property-version asset to the independent buyer and terminally set
   listing `2` to `SOLD`.

Transactions:

- List: `0xd6fd33684e126e70ec30f59e223d1cd9968ad342a5de6e711aa53040bae57288`
- Cancel: `0x6f0d2d1e77f56cab4677a9d0f05c6714bca696e856d7e41c52bd5eb91e802e56`
- Relist: `0x9c8ad59dc90f58ad49dfdad542a301e0517ed8c5e215195fa41a69c42c21d19d`
- Buy: `0x737e4254497e3df57bef8824b944be4b31af1ec04ac87798aba06be4d2fb6577`

## Economic proof

For gross price `10,000,000` octas:

```text
platform fee       200,000 octas  (2%)
royalty             750,000 octas  (7.5%)
seller proceeds   9,050,000 octas
total            10,000,000 octas
```

The buyer additionally paid the snapshotted `926,400` octa storage reimbursement to the seller.
The protocol refunded the buyer exactly `926,400` octas when BUY deleted the seller-funded escrow
and active-asset rows. Gross transaction charge was `1,023,600` octas, making the buyer's net
network cost `97,200` octas. Ledger-version balance reads verified every recipient delta and exact
sale-price conservation.

## Evidence and conclusion

Machine-readable bytecode hashes, transaction receipts, events, fee statements, ownership reads,
and ledger-version balances are in
[`docs/evidence/marketplace-v1-testnet.json`](evidence/marketplace-v1-testnet.json).

Gate D-V1 conclusion: **PASSED**. Direct custody of the exact Token V1 value works for list,
cancel, relist, and atomic purchase, including nonzero property versions and exact royalties. The
package remains upgradeable and unaudited; marketplace frontend actions remain out of scope.
