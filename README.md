# VEYTOS

**The NFT home of Aptos.**

[![CI](https://github.com/bitdealer91/VEYTOS/actions/workflows/ci.yml/badge.svg)](https://github.com/bitdealer91/VEYTOS/actions/workflows/ci.yml)
[![Aptos](https://img.shields.io/badge/network-Aptos%20testnet-2dd8a3.svg)](https://explorer.aptoslabs.com/?network=testnet)

VEYTOS is an Aptos-native NFT launchpad and fixed-price marketplace with publicly
available source code.
It gives creators a single path to launch current Digital Asset collections and
gives collectors one interface for both modern Token V2 assets and historical
Token V1 collections.

[Live testnet application](https://veytos-web.vercel.app) ·
[Architecture](ARCHITECTURE.md) ·
[Security status](SECURITY.md) ·
[Contributing](CONTRIBUTING.md)

> VEYTOS is in public testnet beta. The contracts are upgradeable, have not
> completed an independent external audit, and are not mainnet-ready.

## Why VEYTOS

Aptos has two generations of NFT standards. New launchpads can focus on the
Digital Asset standard, but collectors and creators still need safe discovery and
trading for historical Token V1 assets. VEYTOS treats both as first-class Aptos
assets while keeping settlement authorization on-chain.

- **Aptos-native launchpad:** staged metadata, immutable launch terms, supply and
  wallet limits, royalties, pauses, and atomic APT settlement.
- **V1 and V2 marketplace:** fixed-price list, cancel, and buy flows with adapters
  that validate each asset standard before custody.
- **On-chain authority:** ownership, price, fees, royalties, and settlement are
  verified by Move. The database and UI are discovery layers, not sources of truth.
- **Transparent security model:** privileged roles, invariants, known limitations,
  test coverage, deployment assumptions, and audit handoff are public.
- **Reproducible evidence:** real Aptos testnet deployments, transactions, bytecode
  comparisons, and browser acceptance records are linked from the repository.

## Current status

Completed:

- Aptos Move launchpad and fee policy.
- Token V1 and V2 discovery with strict normalization and complete pagination.
- Fixed-price V1/V2 marketplace settlement.
- Browser wallet flows for mint, list, cancel, and buy.
- PostgreSQL projection schema and resumable marketplace indexer.
- 202 Move security and behavior tests, plus 87 Node/TypeScript and 96 frontend tests.
- Real testnet acceptance for launchpad and marketplace flows.
- Auditor handoff package, threat model, invariant inventory, and release gates.

Before mainnet:

- production creator storage and upload workflow;
- creator and administration interfaces;
- public beta operations and observability;
- independent contract security review and remediation;
- multisig, immutable package publication, and mainnet acceptance ceremony.

## Verified testnet deployments

| Component | Aptos testnet address | Evidence |
| --- | --- | --- |
| Launchpad | `0x5e802dc2d3105fbf967541d9cd64f5d34a18ebb473a4d40ddb26c8f727e9db28` | [Gate A acceptance](TESTNET_ACCEPTANCE.md) |
| Hardened V2 marketplace | `0x0cf2b5af2e168b4ba7f002f705e7f1c1954284756286167800e2b6b11ae6ab64` | [V2 acceptance](docs/MARKETPLACE_TESTNET_ACCEPTANCE.md) |
| V1 marketplace | `0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb` | [V1 acceptance](docs/MARKETPLACE_V1_TESTNET_ACCEPTANCE.md) |

These are disposable, upgradeable development packages. Addresses and transaction
hashes are public blockchain data; no private keys are stored in this repository.
The first launchpad acceptance deployment retains an earlier immutable package
identifier in its historical on-chain record. All active project naming is VEYTOS.

## Architecture

```text
Wallet + Next.js application
          │
          ├── authoritative reads ── Aptos fullnode / Indexer API
          ├── discovery reads ────── PostgreSQL projection
          └── signed transactions ─ Move launchpad and marketplace
                                      │
                                      ├── fee policy
                                      ├── Token V1 escrow adapter
                                      └── Digital Asset V2 escrow adapter
```

Stack: Next.js, React, TypeScript, TanStack Query, Aptos Move, the official Aptos
TypeScript SDK and Wallet Adapter, PostgreSQL/Drizzle, and replaceable IPFS storage.
See [ARCHITECTURE.md](ARCHITECTURE.md) for trust boundaries, standards decisions,
data models, and repository layout.

## Local development

Requirements:

- Node.js 22;
- npm;
- the [official Aptos CLI](https://aptos.dev/build/cli) for Move commands;
- PostgreSQL only when exercising migrations or the durable indexer.

```sh
npm ci
cp .env.example .env
npm run dev
```

The browser application uses `apps/web/.env.local`. Start from
`apps/web/.env.example` and never place private provider keys in a
`NEXT_PUBLIC_*` variable.

## Validation

```sh
npm run check          # TypeScript, Node tests, frontend tests
npm run build          # Production Next.js build
npm run move:test      # Launchpad and marketplace Move tests
npm run move:compile   # Production Move packages
```

GitHub Actions runs the same application and Move gates for every pull request and
push to `main`. Move validation is pinned to Aptos CLI 9.6.0.

## Environment boundaries

The checked-in `.env.example` files contain names and safe defaults only.

- `APTOS_NETWORK` and `NEXT_PUBLIC_APTOS_NETWORK` must agree.
- `NEXT_PUBLIC_LAUNCHPAD_ADDRESS` and `NEXT_PUBLIC_MARKETPLACE_ADDRESS` are public
  on-chain addresses.
- `DATABASE_URL`, `APTOS_API_KEY`, `APTOS_INDEXER_API_KEY`, and `IPFS_API_TOKEN`
  are server-only.
- `VEYTOS_TESTNET_ACCOUNTS_FILE` points to an owner-only file outside the
  repository. Key material never belongs in `.env`.
- `.aptos/`, `.testnet/`, `.vercel/`, populated `.env*`, build output, and local
  dependencies are ignored by Git.

See the environment examples for the complete configuration contract.

## Security

The current code is unaudited and must not be presented as mainnet-ready. Important
residual risks include upgrade authority, retained creator capabilities in some V2
collections, unusual Token V1 configurations, storage economics, and adversarial gas
bounds.

Read:

- [Security status and reporting](SECURITY.md)
- [Auditor handoff](docs/audit/AUDIT_HANDOFF.md)
- [Security invariants](docs/audit/SECURITY_INVARIANTS.md)
- [Known limitations](docs/audit/KNOWN_LIMITATIONS.md)
- [Mainnet release gate](docs/MAINNET_RELEASE_GATE.md)

Do not disclose an exploitable vulnerability in a public issue.

## Roadmap

1. Operate the public testnet beta with durable indexing, storage, monitoring, and
   creator workflows.
2. Complete an independent Move contract audit and remediate all release blockers.
3. Establish multisig operations and publish reviewed immutable mainnet packages.
4. Expand creator tooling and marketplace functionality after the core settlement
   path is proven safe.

## Source availability

The source code is publicly available for evaluation and security review. No
open-source software license is currently granted; all rights are reserved unless
a file explicitly states otherwise. The licensing scope may be updated as VEYTOS
and its ecosystem commitments mature.

Before proposing a change, read [CONTRIBUTING.md](CONTRIBUTING.md).
