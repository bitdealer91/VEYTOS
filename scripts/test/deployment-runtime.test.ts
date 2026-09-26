import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDatabaseEnvironment, validateDeploymentEnvironment } from '../deployment-runtime.ts';

const address = `0x${'1'.repeat(64)}`;
const marketplace = `0x${'2'.repeat(64)}`;
const valid = {
  APTOS_NETWORK: 'testnet', NEXT_PUBLIC_APTOS_NETWORK: 'testnet',
  LAUNCHPAD_ADDRESS: address, NEXT_PUBLIC_LAUNCHPAD_ADDRESS: address,
  MARKETPLACE_ADDRESS: marketplace, NEXT_PUBLIC_MARKETPLACE_ADDRESS: marketplace,
  NEXT_PUBLIC_APP_URL: 'https://beta.veytos.example',
  APTOS_FULLNODE_URL: 'https://rpc.example/v1', NEXT_PUBLIC_APTOS_FULLNODE_URL: 'https://public-rpc.example/v1',
  APTOS_INDEXER_URL: 'https://indexer.example/graphql', NEXT_PUBLIC_APTOS_INDEXER_URL: 'https://public-indexer.example/graphql',
  DATABASE_URL: 'postgresql://user:secret@database.example/veytos?sslmode=require',
  BETA_INDEXER_START_VERSION: '11370375847',
} as NodeJS.ProcessEnv;

test('deployment environment keeps server and browser configuration explicit', () => {
  const result = validateDeploymentEnvironment(valid);
  assert.equal(result.launchpad, address);
  assert.equal(result.marketplace, marketplace);
});

test('deployment environment rejects localhost, plaintext database, address drift and manual seeds', () => {
  assert.throws(() => validateDeploymentEnvironment({ ...valid, NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }));
  assert.throws(() => validateDeploymentEnvironment({ ...valid, DATABASE_URL: 'postgresql://database.example/veytos' }));
  assert.throws(() => validateDeploymentEnvironment({ ...valid, NEXT_PUBLIC_MARKETPLACE_ADDRESS: address }));
  assert.throws(() => validateDeploymentEnvironment({ ...valid, VEYTOS_MARKETPLACE_TXS: '0x1234' }));
});

test('deployment environment fails closed for public endpoints with embedded local assumptions', () => {
  assert.throws(() => validateDeploymentEnvironment({ ...valid, NEXT_PUBLIC_APTOS_FULLNODE_URL: 'http://127.0.0.1:8080/v1' }));
  assert.throws(() => validateDeploymentEnvironment({ ...valid, APTOS_NETWORK: 'mainnet' }));
  assert.throws(() => validateDeploymentEnvironment({ ...valid, BETA_INDEXER_START_VERSION: '-1' }));
});

test('database verification can run independently after migrations', () => {
  assert.equal(validateDatabaseEnvironment({ DATABASE_URL: valid.DATABASE_URL }), valid.DATABASE_URL);
  assert.throws(() => validateDatabaseEnvironment({ DATABASE_URL: 'postgresql://localhost/veytos?sslmode=require' }));
});
