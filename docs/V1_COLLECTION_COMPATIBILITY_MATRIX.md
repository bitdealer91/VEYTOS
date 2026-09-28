# Token V1 historical compatibility matrix

Status: mainnet collection research remains read-only; separate restricted-policy acceptance was completed on Aptos Testnet on 2026-09-28. No mainnet transaction was signed or submitted. These mainnet rows are token-data samples, not collection-wide transfer certification.

Evidence: [fresh fullnode observations](evidence/phase3c-v1-readonly.json), [2026-09-24 TokenData observations](evidence/phase2a-og-token-data.json), [historical identity/provenance research](LEGACY_COLLECTION_COMPATIBILITY.md), and [restricted V1 remediation acceptance](evidence/marketplace-v1-creator-burn-remediation-testnet.json). Fresh mainnet queries used the existing canonical creators, GET `0x3::token::Collections`, then read-only POST `/tables/{token_data_handle}/item` with TokenDataId/TokenData types. Ledger chain ID was 1. Rows were read at separate ledger versions, not one atomic snapshot. Creator canonicality is inherited from prior provenance research; the reads confirm state under those identities, not current project endorsement.

Supported public-beta policy is fail-closed: `property_version == 0`, TokenData maximum `== 1`, exact seller balance `== 1`, and authoritative TokenData default property `TOKEN_BURNABLE_BY_CREATOR` must be absent or a well-formed `false`. Existing identity, withdrawal, amount, royalty and economics checks must also pass. Creator-burn true, malformed creator-burn state, every nonzero property version and any other failed predicate are unsupported. This is enforced by Move; frontend eligibility is explanatory defense in depth.

Classifications:

- **SUPPORTED BY CURRENT CHECKS:** an exact token/owner configuration passes the current custody predicates and relevant simulation; it does not certify all members of a collection.
- **REQUIRES PER-TOKEN VALIDATION:** sampled TokenData is structurally consistent, but exact holder balance/property version/withdrawability and residual capabilities remain unverified.
- **CURRENTLY UNSUPPORTED:** fails native maximum=1, exact balance=1, valid royalty/deductions or another mandatory adapter predicate.

All four collections below are **REQUIRES PER-TOKEN VALIDATION**. None is promoted to blanket support based on one sample.

## Aptos Monkeys

- Canonical creator from prior research: `0xf932dcb9835e681b21d2f411ef99f4f5e577e6ac299eebee2272a39fb348f702`.
- Exact collection string: `Aptos Monkeys`; sampled token name: `AptosMonkeys #1`.
- Token V1 identity: `(creator, collection, token name, property_version)`; an Indexer hash is not a V2 object address.
- Read ledger version: `7372467990`; TokenData handle: `0xdbf0eaecdbacc59c9aecc83cea1365faa9aa6fb1f8a85f3048ab291a6238378f`.
- Sample maximum/supply: `1/1`. This passes the sampled maximum predicate, not the holder balance predicate.
- Largest property version: `0`. This is a TokenData counter, not proof of the current holder's exact property version. Preserve the version from the actual TokenStore row. Nonzero Bruh Bears versions must never be collapsed to zero.
- Royalty sample: `500/10000`, payee `0x89e272841c2381ec63e7d8ccf6a70bd784b2a9dda6d6425aeb31657f4a5619c0`. Read the exact token at listing; do not apply this fraction to the entire collection.
- All five observed mutability flags (maximum, URI, royalty, description, properties) are true; sampled default property map is empty. This does not prove absence of every historical burn/delegation path or per-version custom property.
- Classification: **REQUIRES PER-TOKEN VALIDATION**.
- Withdrawal/transfer evidence: TokenData exists and sampled maximum/royalty shape satisfy current adapter checks; no owner-specific withdrawal simulation or custody transaction was performed. TokenStore balance, current property version and constraints for a real holder remain unknown. Recipient direct-transfer opt-in is not a requirement for this adapter's authenticated `deposit_token` cancel/buy path.
- Remaining unknowns: other tokens' maximum/royalty/mutability, exact holder state and pending claims, outstanding expiring WithdrawCapability values, post-sample mutations and real-holder transaction simulation. Mainnet RPC reads alone cannot establish these.

## Aptomingos

- Canonical creator from prior research: `0xc0e3fbf8ae61056d66ce624d71ccf1888f879355cc4e364ef117249b5e3160a8`.
- Exact collection string: `Aptomingos`; sampled token name: `Aptomingo #1`.
- Token V1 identity: `(creator, collection, token name, property_version)`; an Indexer hash is not a V2 object address.
- Read ledger version: `7372468113`; TokenData handle: `0x6436e04f8c26e378ab6cd463fbeb3a040d0bf9b01e16387044f9c6fc29946b6`.
- Sample maximum/supply: `1/1`. This passes the sampled maximum predicate, not the holder balance predicate.
- Largest property version: `0`. This is a TokenData counter, not proof of the current holder's exact property version. Preserve the version from the actual TokenStore row. Nonzero Bruh Bears versions must never be collapsed to zero.
- Royalty sample: `800/10000`, payee `0x4230ae221d653cc39b40140f11783a45b557fe560b21461dacbd46094bf1b7b3`. Read the exact token at listing; do not apply this fraction to the entire collection.
- All five observed mutability flags (maximum, URI, royalty, description, properties) are true; sampled default property map is empty. This does not prove absence of every historical burn/delegation path or per-version custom property.
- Classification: **REQUIRES PER-TOKEN VALIDATION**.
- Withdrawal/transfer evidence: TokenData exists and sampled maximum/royalty shape satisfy current adapter checks; no owner-specific withdrawal simulation or custody transaction was performed. TokenStore balance, current property version and constraints for a real holder remain unknown. Recipient direct-transfer opt-in is not a requirement for this adapter's authenticated `deposit_token` cancel/buy path.
- Remaining unknowns: other tokens' maximum/royalty/mutability, exact holder state and pending claims, outstanding expiring WithdrawCapability values, post-sample mutations and real-holder transaction simulation. Mainnet RPC reads alone cannot establish these.

## Bruh Bears

- Canonical creator from prior research: `0x043ec2cb158e3569842d537740fd53403e992b9e7349cc5d3dfaa5aff8faaef2`.
- Exact collection string: `Bruh Bears`; sampled token name: `Bruh Bear #1`.
- Token V1 identity: `(creator, collection, token name, property_version)`; an Indexer hash is not a V2 object address.
- Read ledger version: `7372468286`; TokenData handle: `0xba0ae903f5d5c58d5570157824f18b243d0529959e9a12669ab32a03524a1846`.
- Sample maximum/supply: `1/1`. This passes the sampled maximum predicate, not the holder balance predicate.
- Largest property version: `1`. This is a TokenData counter, not proof of the current holder's exact property version. Preserve the version from the actual TokenStore row. Nonzero Bruh Bears versions must never be collapsed to zero.
- Royalty sample: `550/10000`, payee `0x5aa4efe9703ffba6082906721756da68b9f7e8d256ed719cf49c40cab3938650`. Read the exact token at listing; do not apply this fraction to the entire collection.
- All five observed mutability flags (maximum, URI, royalty, description, properties) are true; sampled default property map is empty. This does not prove absence of every historical burn/delegation path or per-version custom property.
- Classification: **REQUIRES PER-TOKEN VALIDATION**.
- Withdrawal/transfer evidence: TokenData exists and sampled maximum/royalty shape satisfy current adapter checks; no owner-specific withdrawal simulation or custody transaction was performed. TokenStore balance, current property version and constraints for a real holder remain unknown. Recipient direct-transfer opt-in is not a requirement for this adapter's authenticated `deposit_token` cancel/buy path.
- Remaining unknowns: other tokens' maximum/royalty/mutability, exact holder state and pending claims, outstanding expiring WithdrawCapability values, post-sample mutations and real-holder transaction simulation. Mainnet RPC reads alone cannot establish these.

## Pontem Space Pirates

- Canonical creator from prior research: `0xc46dd298b89d38314b486b2182a6163c4c955dce3509bf30751c307f5ecc2f36`.
- Exact collection string: `Pontem Space Pirates`; sampled token name: `Space Pirate #1`.
- Token V1 identity: `(creator, collection, token name, property_version)`; an Indexer hash is not a V2 object address.
- Read ledger version: `7372468394`; TokenData handle: `0x53c9b18b912930a91df1d727e0333cac55b830405e2a4b305772c88fec2f3845`.
- Sample maximum/supply: `1/1`. This passes the sampled maximum predicate, not the holder balance predicate.
- Largest property version: `0`. This is a TokenData counter, not proof of the current holder's exact property version. Preserve the version from the actual TokenStore row. Nonzero Bruh Bears versions must never be collapsed to zero.
- Royalty sample: `0/10000`, payee `0xf9359556f1101567722a17cabe506670e0627d20b0b8048cfa9ab9a4f719f771`. Read the exact token at listing; do not apply this fraction to the entire collection.
- All five observed mutability flags (maximum, URI, royalty, description, properties) are true; sampled default property map is empty. This does not prove absence of every historical burn/delegation path or per-version custom property.
- Classification: **REQUIRES PER-TOKEN VALIDATION**.
- Withdrawal/transfer evidence: TokenData exists and sampled maximum/royalty shape satisfy current adapter checks; no owner-specific withdrawal simulation or custody transaction was performed. TokenStore balance, current property version and constraints for a real holder remain unknown. Recipient direct-transfer opt-in is not a requirement for this adapter's authenticated `deposit_token` cancel/buy path.
- Remaining unknowns: other tokens' maximum/royalty/mutability, exact holder state and pending claims, outstanding expiring WithdrawCapability values, post-sample mutations and real-holder transaction simulation. Mainnet RPC reads alone cannot establish these.

## Required per-token pre-listing procedure

Confirm chain ID and canonical creator/collection/name; require exact property_version=0 and holder TokenStore amount=1. Require TokenData maximum=1; authoritative default `TOKEN_BURNABLE_BY_CREATOR` absent or well-formed false; amount one on withdrawal; positive price; valid royalty denominator/numerator/payee; and strictly positive seller proceeds after platform fee. Use direct chain state at execution; display the current snapshot before signing. Where a holder has authorized read-only simulation, simulate the exact transaction and inspect aborts/custody/economics without submitting it. Recheck every predicate in Move at execution; frontend, indexer and simulation results do not authorize trading.

Do not accept an asset solely because it is a recognized historical collection. Maximum zero/unbounded, maximum>1, malformed/missing mandatory data, nonzero property version, creator-burn true or malformed, and unacceptable royalties are CURRENTLY UNSUPPORTED. Mutable maximum means uniqueness at list time is not a lifetime scarcity promise. Native V1 delegated withdrawal cannot reach the private escrow Token but may act after return to its recorded owner; the regression tests document this remaining Token V1 limitation.
