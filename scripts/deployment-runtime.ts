import assert from 'node:assert/strict';

const addressPattern = /^0x[0-9a-f]{64}$/;
const u64Pattern = /^\d+$/;
const requiredTables = Object.freeze([
  'indexer_checkpoints',
  'marketplace_events',
  'marketplace_listings',
  'launchpad_events',
]);

function httpsUrl(value: string | undefined, name: string) {
  assert(value, `${name} is required`);
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', `${name} must use HTTPS`);
  assert(url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', `${name} must not use localhost`);
  return url;
}

export function validateDatabaseEnvironment(env: NodeJS.ProcessEnv) {
  const databaseUrl = env.DATABASE_URL;
  assert(databaseUrl, 'DATABASE_URL is required');
  const database = new URL(databaseUrl);
  assert(database.protocol === 'postgres:' || database.protocol === 'postgresql:', 'DATABASE_URL must be PostgreSQL');
  assert(database.hostname !== 'localhost' && database.hostname !== '127.0.0.1', 'DATABASE_URL must not use localhost');
  assert(['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode') || ''), 'DATABASE_URL must require TLS with sslmode');
  return databaseUrl;
}

export function validateDeploymentEnvironment(env: NodeJS.ProcessEnv) {
  assert.equal(env.APTOS_NETWORK, 'testnet', 'APTOS_NETWORK must be testnet');
  assert.equal(env.NEXT_PUBLIC_APTOS_NETWORK, 'testnet', 'NEXT_PUBLIC_APTOS_NETWORK must be testnet');
  const launchpad = env.LAUNCHPAD_ADDRESS;
  const publicLaunchpad = env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;
  const marketplace = env.MARKETPLACE_ADDRESS;
  const publicMarketplace = env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
  assert(launchpad && addressPattern.test(launchpad), 'LAUNCHPAD_ADDRESS must be a canonical Aptos address');
  assert(marketplace && addressPattern.test(marketplace), 'MARKETPLACE_ADDRESS must be a canonical Aptos address');
  assert.equal(publicLaunchpad, launchpad, 'Public and server launchpad addresses must match');
  assert.equal(publicMarketplace, marketplace, 'Public and server marketplace addresses must match');
  httpsUrl(env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL');
  httpsUrl(env.APTOS_FULLNODE_URL, 'APTOS_FULLNODE_URL');
  httpsUrl(env.APTOS_INDEXER_URL, 'APTOS_INDEXER_URL');
  httpsUrl(env.NEXT_PUBLIC_APTOS_FULLNODE_URL, 'NEXT_PUBLIC_APTOS_FULLNODE_URL');
  httpsUrl(env.NEXT_PUBLIC_APTOS_INDEXER_URL, 'NEXT_PUBLIC_APTOS_INDEXER_URL');
  const databaseUrl = validateDatabaseEnvironment(env);
  assert(env.BETA_INDEXER_START_VERSION && u64Pattern.test(env.BETA_INDEXER_START_VERSION), 'BETA_INDEXER_START_VERSION is required');
  assert(BigInt(env.BETA_INDEXER_START_VERSION) <= (1n << 64n) - 1n, 'BETA_INDEXER_START_VERSION exceeds u64');
  assert(!env.VEYTOS_ACTIVITY_TXS && !env.VEYTOS_MARKETPLACE_TXS && !env.VEYTOS_DISCOVERY_DROPS, 'Production must use the durable projection instead of manual discovery seeds');
  return { launchpad, marketplace, databaseUrl, requiredTables };
}

export { requiredTables };
