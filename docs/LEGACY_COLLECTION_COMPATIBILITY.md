# Historical Aptos NFT compatibility

Status: Phase 1B research, 2026-09-24. This is a read-only compatibility record,
not an endorsement or a promise that an asset can be listed. Mainnet identities
were checked against the Aptos Labs Indexer. Names alone are not identities: the
Indexer contains unrelated collections with duplicate names.

## Standards that VEYTOS must preserve

### Token V1 (legacy)

- Identity is `(creator, collection name, token name, property version)`. The
  Indexer's `token_data_id` and `collection_id` hashes are useful query keys, but
  VEYTOS must retain the tuple and must not present either hash as a V2 object.
- Ownership is an amount in the owner's `0x3::token::TokenStore`. Property version
  zero may be semi-fungible; a mutated copy receives a new property version.
- Metadata, royalty and mutability live in creator-owned `TokenData` and
  `CollectionData` tables. The current combined Indexer views expose normalized
  token/collection data and `current_token_royalty_v1`; the old
  `current_token_datas` table now returns a deprecation error.
- A two-signer `direct_transfer` is always possible. Single-signer transfer to an
  address requires that recipient to opt into direct transfer. The legacy
  `token_transfers` offer/claim path leaves the NFT with the sender until claim.
  These semantics are materially different from an object transfer.
- V1 has expiring, amount-bounded withdraw capabilities, but there is no uniform
  marketplace approval convention deployed across old collections. Listing
  compatibility must therefore be established by an actual custody transaction,
  not inferred from Indexer classification.
- Royalty fields record a payee and fraction. They do not force every independent
  transfer to pay. A marketplace must calculate and settle the royalty explicitly.
- URI, description, supply maximum, royalties and properties may be mutable.
  Creator/owner burn flags can exist in default properties. The current public
  combined view does not expose enough data to certify all historical mutation or
  burn settings; those values remain **UNKNOWN / UNVERIFIED** until a pre-listing
  resource check or simulation is implemented.

### Digital Asset / Token V2

- A token and collection are Objects under `0x4`; their object addresses are the
  canonical identities. Ownership is read from `ObjectCore` and indexed in the
  same current ownership view used by the official TypeScript SDK.
- A normal owner can call `object::transfer` when ungated transfer is enabled.
  Collections may create untransferable tokens, disable ungated transfer, retain
  transfer capabilities, or add collection-specific resources and hooks.
- Metadata can be native on the token/collection with a URI to external JSON.
  Named and unnamed token creation differ, so enumeration should use the Indexer.
- Native royalty data may be attached to a token or inherited from its collection.
  A retained royalty mutator can change it. As in V1, recording a royalty is not
  universal enforcement on arbitrary object transfers.
- A marketplace must inspect the exact object and simulate custody before accepting
  a listing. Classification as V2 does not imply transferability.

Official sources: [Digital Asset standard](https://aptos.dev/build/smart-contracts/digital-asset),
[legacy Token standard](https://aptos.dev/build/smart-contracts/aptos-token),
[V1 framework module](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token/sources/token.move),
[V1 offer/claim module](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token/sources/token_transfers.move),
[V2 token module](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token-objects/sources/token.move), and
[Object framework](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/object.move).

## Verified historical collections

All four canonical collections below are Token V1. Supply is the current/max
supply reported by `current_collections_v2` at the research date. Royalty is from
one verified token row in `current_token_royalty_v1`; V1 royalties are token-data
fields, so a marketplace must read the listed token rather than assume every item
has the sample value.

### Aptos Monkeys

- Creator: `0xf932dcb9835e681b21d2f411ef99f4f5e577e6ac299eebee2272a39fb348f702`
- Indexer collection ID: `0x7ac8cecb76edbbd5da40d719bbb9795fc5744e4098ee0ce1be4bb86c90f42301`
- Supply: `7,777 / 7,777`
- Table handle: `0xb718feaaf6a00862ad067cdbac3f3ba54f0603026183ed4a7c06940da6b37e93`
- Metadata: token JSON uses canonical `ipfs://` URIs; collection URI is a hosted image URL.
- Sample royalty: `500 / 10,000` (5%), payee
  `0x89e272841c2381ec63e7d8ccf6a70bd784b2a9dda6d6425aeb31657f4a5619c0`.
- Trading assessment: structurally supportable by a V1 custody adapter. Per-token
  mutation/burn settings and a successful custody simulation remain required.

### Aptomingos

- Creator: `0xc0e3fbf8ae61056d66ce624d71ccf1888f879355cc4e364ef117249b5e3160a8`
- Indexer collection ID: `0xe6a7399d10406b993e25d8a3bf24842413ba8f1a08444dbfa5f1c31b09f0d16e`
- Supply: `1,212 / 1,212`
- Table handle: `0x73ffa67834b857c945c2b9a49d1e5300d240aaed3414e4412a80a63aa34fa399`
- Metadata: collection uses `ipfs://`; sampled token metadata is on Arweave.
- Sample royalty: `800 / 10,000` (8%), payee
  `0x4230ae221d653cc39b40140f11783a45b557fe560b21461dacbd46094bf1b7b3`.
- Trading assessment: structurally supportable by a V1 custody adapter. An
  additional same-name 1,212-item row exists; it is not treated as canonical
  because the historical marketplace identity points to the creator above.

### Bruh Bears

- Creator: `0x043ec2cb158e3569842d537740fd53403e992b9e7349cc5d3dfaa5aff8faaef2`
- Indexer collection ID: `0xda59e5f610419f274a20341fb198bf98415712de11a4468cfd45cbe495600c2a`
- Supply: `5,000 / 5,000`
- Table handle: `0xe5fd220d92e671c2d607d44b2bd140fc7628baa50940c2fbec10215135e13403`
- Metadata: collection and sampled token JSON use `ipfs://`.
- Sample royalty: `550 / 10,000` (5.5%), payee
  `0x5aa4efe9703ffba6082906721756da68b9f7e8d256ed719cf49c40cab3938650`.
- Compatibility note: the sampled token data has property versions above zero in
  circulation, so property version is mandatory in token identity.
- Trading assessment: structurally supportable by a V1 custody adapter after the
  token-specific checks described above.

### Pontem Space Pirates

- Creator: `0xc46dd298b89d38314b486b2182a6163c4c955dce3509bf30751c307f5ecc2f36`
- Indexer collection ID: `0xaece05d29c0b543be608d73c44d8bb46a09e18e06097f7fdec078689e52ed118`
- Supply: `1,000 / 1,000`
- Table handle: `0x749f065cc6b2658ac289bf643dea7dc95293278804a34e3c1cf03d91c55b1063`
- Metadata: sampled token JSON uses `ipfs://`; collection URI is a hosted GIF.
- Sample royalty: `0 / 10,000`, payee
  `0xf9359556f1101567722a17cabe506670e0627d20b0b8048cfa9ab9a4f719f771`.
- Trading assessment: structurally supportable by a V1 custody adapter after the
  token-specific checks described above.

Historical marketplace slugs were used only to disambiguate creator identities;
all chain fields above came from Aptos mainnet. Pontem's own collection page also
describes 1,000 Space Pirates. Verification is provenance evidence, not financial
or safety certification.

## Live mainnet smoke test

On 2026-09-24 the official Indexer returned 638 current positive-balance rows over
seven pages for public wallet
`0x0f3f84a5fbec5473ca5ee4b4b69a56d480951c89084a9127d1129059137238d1`.
VEYTOS classified both V1 and V2 rows and rejected zero malformed rows. It found
Pontem Space Pirates #1, #425 and #847 using the canonical creator and collection
identity above. The query was read-only and used no key. Reproducible public
evidence is in `docs/evidence/phase1b-mainnet-discovery.json`.

## Remaining unknowns

- Current operators, official verification policy, and off-chain project ownership
  are outside chain state: **UNKNOWN / UNVERIFIED**.
- Collection-wide royalty percentages cannot safely be inferred from one V1 token:
  read the token being listed.
- Transferability, creator-burn flags and mutable properties need deterministic
  per-token pre-listing checks.
- IPFS/Arweave availability is not guaranteed by a canonical URI. UI metadata
  failure must remain isolated from ownership discovery.
