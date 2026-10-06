# V2 collection provenance review

Status: required operational control for VEYTOS Marketplace V2 listings. Approval
means that the collection's transfer-capability behavior was reviewed; it is not a
claim of financial value, authenticity, creator conduct or metadata safety.

## Why review is mandatory

An Aptos Digital Asset creator may retain a `TransferRef` when an NFT is created.
That capability can produce a one-use transfer reference based on the NFT's current
owner, including a marketplace escrow object. There is no generic on-chain query
that proves all copies of such a capability were destroyed. A successful ordinary
transfer therefore does not prove that escrow cannot later be bypassed.

The on-chain VEYTOS registry is a listing-admission boundary. Unreviewed or revoked
collections cannot create new listings. Registry administration never receives an
NFT capability and cannot move, cancel or redirect individual assets. Revocation
does not affect seller cancellation of existing escrow.

## Provenance classes

1. **VEYTOS-launched (`1`)** — verify the canonical collection was created by the
   deployed VEYTOS launchpad package and that the relevant source/bytecode discards
   NFT transfer, burn and mutation capabilities as documented.
2. **Reviewed third-party (`2`)** — review the exact deployed creator modules and
   capability lifecycle. Public branding or a successful test transfer is not enough.

The provenance value is recorded on-chain with the canonical collection object
address. Both classes use the same settlement invariants after admission.

## Required evidence

Record, without secrets:

- network and canonical collection object address;
- collection creator and package/deployer address;
- deployed module bytecode or verified source and package upgrade policy;
- Aptos framework/token standard version used by the deployment;
- current direct and ungated transfer behavior;
- every creation-time `TransferRef`, `ExtendRef`, `BurnRef`, royalty mutator and
  metadata/property mutator path found in source;
- freeze/unfreeze, soulbound, custom transfer and dispatch-hook behavior;
- token-level and collection-level royalty configuration and mutation authority;
- whether ownership may be nested and any custom resources that restrict transfer;
- testnet reproduction transactions when the deployed design can be reproduced;
- reviewer, review date, source commit and decision rationale.

Compare deployed bytecode with reviewed artifacts wherever source is available.
For upgradeable packages, document who controls upgrades and treat a later upgrade
as invalidating the review until reassessed.

## Decision procedure

Approve only when reviewers can establish that listing, isolated escrow, seller
cancellation and buyer delivery behave as expected and no retained authority can
remove the NFT from escrow. If capability safety is unknown, source is unavailable,
bytecode does not match, or transfer behavior cannot be reproduced, **do not approve
the collection**.

Approval is performed with `marketplace::set_v2_collection_reviewed` using the
canonical collection object and the supported provenance class. Verify the emitted
policy event and read the registry view after commitment.

For the repository's testnet launch pipeline, this admission is part of drop
finalization rather than a separate operator task. The pipeline reads the finalized
drop from the deployed launchpad, uses its canonical collection object, resolves the
current marketplace admin from on-chain configuration, submits provenance class `1`
only when the policy is still absent, and verifies `[reviewed=true, provenance=1]`
after commitment. The signer remains in the protected external testnet account file;
it is never exposed to the web application.

Mainnet admission must use the configured marketplace multisig and retain the same
evidence review. Do not put an admin key in a web server or browser merely to make
approval appear automatic.

## Revocation and incident response

Revoke future listing eligibility when a package upgrades, retained authority is
discovered, or transfer behavior changes. If escrowed assets may be affected, also
pause V2 purchases while keeping authenticated seller cancellation available.
There is no admin rescue or seizure function. Any proposed recovery change requires
separate review, tests and disclosure.
