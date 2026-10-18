# Marketplace post-remediation Testnet acceptance

Date: 2026-10-18. Network: Aptos Testnet, chain ID 2. No mainnet transaction was submitted.

## Package upgrade

- Package address: `0x6402e274769885692940cf139d8ee9978d79192e3315e2088fd586c2d9173f91`
- Reviewed source commit: `98419a8`
- Upgrade transaction: `0x0f14e111368793bf27a8b2411146369f27438ce285627ea1e4f40634139e933a`
- Ledger version: `104592915`
- Upgrade number: `0 -> 1`
- VM status: `Executed successfully`
- Source digest: `FAFA24C8D748FAB1AC662211147926321242B632B64EC8DD1596E0CE6F9E84CF`

All four deployed production modules matched the locally compiled bytecode. Both protected `list_with_terms` functions are published as entry functions with package/friend visibility. The Aptos SDK successfully resolved their live ABI and submitted direct transactions. External-address Move wrappers remain unable to call them.

## V1 safe lifecycle

- LIST: `0x1912f1d33fe1ef3d6845a33f9b0532546c695287ae73ef5dd0d736d836ad9ede`
- CANCEL: `0x7f429c5be09652fab3d170ad5cef4b6e80e74cf8fb8ad2eea1a0394f9780f8fe`
- RELIST: `0x626d733e2e8e479c11955b667f15f61183ebb3f789694db6c0cf7b2225d762c0`
- BUY: `0x129626a0bf63af78a349a6278aecd8fa56e304e50e1789a24be3ceb197a2cf57`
- Listing IDs: `24` cancelled, `25` sold
- Final owner: `0x51223eb03eebd08713fee79d982ef98ab715094e90575451a9d7afcb12a40eb2`

The exact property-version-zero Token V1 identity moved seller → escrow → seller → escrow → buyer. Statuses, escrow presence and canonical events matched the lifecycle.

## V2 safe lifecycle

The launchpad-created collection `0x287dea5ae1c96817a211877faf19b38d1884fb4a59305101db44fc32fb609e61` was approved with VEYTOS provenance:

- Registry approval: `0x0f90c6ce956facc7c5e26d5c6ac36ac1f727576196d6f13d0607e8d787d70604`
- LIST: `0x197805f31c748295c222b672f6f544003a87519a9f9ab0e9542409e343c6cee2`
- CANCEL: `0x5ebf9c40832fae37bef8fb16d6f57bb37c26f101fbd315c8c1d71f6c40b814e7`
- RELIST: `0x397318e4289974af9dde444d10b3f79681a651c1b594a2405f2502871d572e38`
- BUY: `0x3d8fb070266b0fee031008a2c92df11efb0983fb7075a1d8ebad8ddde4efbab7`
- Listing IDs: `26` cancelled, `27` sold
- Final owner: `0x51223eb03eebd08713fee79d982ef98ab715094e90575451a9d7afcb12a40eb2`

## Economics

For both successful purchases:

- Gross: `10,000,000` octas
- Platform fee, 2%: `200,000` octas
- Royalty, 7.5%: `750,000` octas
- Seller proceeds: `9,050,000` octas
- V1 storage reimbursement: `933,600` octas
- V2 storage reimbursement: `926,400` octas

The event amounts and historical balance deltas matched exactly. `gross = platform fee + royalty + seller proceeds`; reimbursement was transferred separately according to the listing snapshot.

## Committed rejection evidence

- Creator-burnable V1: `0x9d400d46ac60fdf874d7487f74fa82cfc26d7fc26cf409100226c3824cd3b6da` — `ECREATOR_BURNABLE(0x9)`
- Nonzero property version V1: `0xd227a8d72fdd08468ebeefcb140f7dbe73971a852a2aa7958e1ee5615aa57ef3` — `EUNSUPPORTED_PROPERTY_VERSION(0xa)`
- Stale V1 terms: `0xe0811fed3fa259597769846c05f415dec85b221164bf87ae8feb421de0e8702a` — `ELISTING_TERMS_CHANGED(0x11)`
- Stale V2 terms: `0xb5654f952162a241f47ad3cd96989a5951b5c9980584cc8278eea7354c072bcc` — `ELISTING_TERMS_CHANGED(0x11)`
- Legacy V1 LIST: `0xfddfc3f7833035d6639b1023528188b7b963584f91ae0c72aa67cbf8e42e8724` — `EUNSAFE_LIST_ABI(0xb)`
- Legacy V2 LIST: `0x4ebd974eac51219f65f4359f67a12afe279c278be1e8d7191ce34468c4a36b2f` — `EUNSAFE_LIST_ABI(0xa)`

The rejected creator-burnable and nonzero-version assets remained with their owner. Stale-term and legacy-ABI attempts did not create listings; `nextListingId` remained `28` across the final legacy rejection checks. Failed transactions charged gas but produced no marketplace event, custody transfer or payment.

Machine-readable public evidence: [`evidence/marketplace-post-remediation-testnet-2026-10-18.json`](evidence/marketplace-post-remediation-testnet-2026-10-18.json).

## Residual limitations

- This is Testnet acceptance, not an external audit or mainnet authorization.
- The Testnet package remains compatible-upgradeable.
- Third-party V2 collections still require independent retained-capability review.
- Storage reimbursement remains a configured policy amount and still requires current-mainnet calibration before release.
