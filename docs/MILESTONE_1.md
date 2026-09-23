# Milestone 1 — foundation evidence

Date: 2026-09-23. Starting repository: empty, no existing Git repository or source.
No existing application was replaced. Work follows the research/design/data-model/
contract-test order requested for Phase 1.

## Research completed

Official Aptos documentation reviewed for DA, Objects, wallet adapter, SDK, Indexer
and events. Official framework source inspected at the pinned testnet branch commit
for collection, token, royalty, property_map, object and APT transfer APIs.
Official npm registry returned SDK 7.3.0 and wallet adapter 8.3.3 as stable versions.
These integration libraries are selected, not yet installed or wallet-tested.

Notable result: framework `collection::set_max_supply` exists despite the overview's
immutability statement. The planned launchpad discards mutation capabilities and
enforces an independent lifetime supply cap. See ARCHITECTURE.md for sources.

## Executed checks

- `npm run check`: strict TypeScript check and 9 tests passed.
- `npm run move:test`: Aptos CLI 9.6.0, 24 tests passed, 0 failed.
- `npm run move:compile`: standalone compilation succeeded for `fee_policy`.
- `npm ci`: clean lockfile installation succeeded; 0 reported vulnerabilities.
- `npm run db:generate`: generated 13-table PostgreSQL migration successfully;
  subsequent generation after dependency override found no schema changes.
- Dependency installation after targeted esbuild override: npm reported
  0 vulnerabilities. Drizzle loader still emits upstream deprecation notices.

The initial Move runner was invoked before a sources directory existed and failed;
the subsequent compiler rejected tuple equality in two tests. Assertions were fixed
to compare tuple components. The final Move test run passed. No failure was replaced
with fixture success or bypassed assertions.

Standalone compilation initially returned success alongside a macOS system-
configuration worker panic inside the sandbox. Repeating outside the sandbox
completed cleanly. Compilation evidence uses that clean run.

## Implemented scope

Configuration/branding, integer money and metadata domain validation, storage
interface, constrained database schema/migration, Move fee-policy module and tests,
architecture/security/mainnet documents and local test/migration commands.

## Explicitly not verified

- No testnet transaction, contract publication or funded-wallet interaction.
- No DA collection creation, NFT ownership, payment transfer or mint test yet.
- No PostgreSQL instance was available; migration application and database runtime
  behavior remain untested (SQL generation is not migration execution).
- No frontend, browser build, wallet/mobile flow or upload provider implementation.
- No independent security audit, mainnet compatibility proof or production readiness.

Next gate: native collection/mint Move tests and contract implementation. Full
Phase 1 acceptance and Phase 2 remain incomplete.
