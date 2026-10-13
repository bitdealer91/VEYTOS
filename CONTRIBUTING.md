# Contributing to VEYTOS

Thank you for helping improve VEYTOS. The repository contains an Aptos Move
launchpad and marketplace, a Next.js application, an indexer, and supporting
TypeScript packages.

## Before you start

- Use Node.js 22 and the npm version bundled with it.
- Install the official Aptos CLI. CI currently validates with Aptos CLI 9.6.0.
- Never commit private keys, seed phrases, wallet backups, populated `.env`
  files, database credentials, API tokens, or signed transactions.
- Report exploitable security issues privately as described in
  [SECURITY.md](SECURITY.md). Do not open a public issue for a vulnerability.

## Local setup

```sh
npm ci
cp .env.example .env
npm run check
npm run build
npm run move:test
npm run move:compile
```

The Move commands use development addresses and cannot publish a package. On-chain
acceptance and deployment scripts require explicit testnet configuration and are
not part of the normal contribution workflow.

## Pull requests

Keep changes focused and explain:

1. the user or protocol problem being solved;
2. the security and compatibility impact;
3. the checks run locally;
4. any database, environment, deployment, or on-chain migration requirement.

Add or update tests for behavior changes. Contract changes must update the relevant
threat model, audit scope, and acceptance plan. Do not weaken fail-closed behavior,
authority checks, amount conservation, or network/address validation to make a test
pass.

## Project naming

VEYTOS is the only active project and product name. Historical evidence may retain
an earlier immutable on-chain package identifier when changing it would make the
record inaccurate; new code, fixtures, documentation, and deployments must use
VEYTOS.

## Contribution terms

The repository does not currently grant a public software license. Do not submit
third-party code unless you have the rights required to contribute it. Contact the
maintainers before preparing a substantial contribution; separate contribution
terms may be required before it can be accepted.
