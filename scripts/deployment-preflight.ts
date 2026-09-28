import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { requestHeaders } from './indexer-runtime.ts';
import { requiredTables, validateDatabaseEnvironment, validateDeploymentEnvironment } from './deployment-runtime.ts';

const databaseOnly = process.argv.includes('--database-only');
const requireCheckpoint = process.argv.includes('--require-checkpoint');
const configuration = databaseOnly ? null : validateDeploymentEnvironment(process.env);
const databaseUrl = configuration?.databaseUrl || validateDatabaseEnvironment(process.env);
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 8_000 });

async function verifyDatabase() {
  const client = await pool.connect();
  try {
    const tables = await client.query<{ name: string | null }>(
      'SELECT to_regclass(name)::text AS name FROM unnest($1::text[]) AS requested(name)',
      [requiredTables.map((name) => `public.${name}`)],
    );
    assert.equal(tables.rows.length, requiredTables.length, 'Database schema verification returned an unexpected table count');
    assert(tables.rows.every((row) => row.name), `Missing required database tables: ${requiredTables.join(', ')}`);
    const tls = await client.query<{ ssl: boolean }>('SELECT COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()), false) AS ssl');
    assert.equal(tls.rows[0]?.ssl, true, 'PostgreSQL connection is not using TLS');
    const checkpoint = configuration ? await client.query<{ next_version: string }>(
      'SELECT next_version FROM indexer_checkpoints WHERE network=$1 AND processor=$2',
      ['testnet', `marketplace:${configuration.marketplace}`],
    ) : { rowCount: 0, rows: [] as { next_version: string }[] };
    if (requireCheckpoint) assert.equal(checkpoint.rowCount, 1, 'Indexer checkpoint has not been created');
    const counts = await client.query<{ listings: string; marketplace_events: string; launchpad_events: string }>(
      'SELECT (SELECT count(*) FROM marketplace_listings)::text AS listings, (SELECT count(*) FROM marketplace_events)::text AS marketplace_events, (SELECT count(*) FROM launchpad_events)::text AS launchpad_events',
    );
    return { tls: true, checkpoint: checkpoint.rows[0]?.next_version || null, ...counts.rows[0] };
  } finally {
    client.release();
  }
}

async function verifiedFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  assert(response.ok, `Deployment dependency returned HTTP ${response.status}`);
  return response;
}

async function verifyChainDependencies() {
  assert(configuration, 'Deployment configuration is required');
  const fullnode = process.env.APTOS_FULLNODE_URL!.replace(/\/$/, '');
  const headers = requestHeaders(process.env.APTOS_API_KEY);
  const ledger = await verifiedFetch(fullnode, { headers }).then((response) => response.json()) as { chain_id?: number };
  assert.equal(ledger.chain_id, 2, 'Configured fullnode is not Aptos testnet');
  await Promise.all([
    verifiedFetch(`${fullnode}/accounts/${configuration.launchpad}/module/launchpad`, { headers }),
    verifiedFetch(`${fullnode}/accounts/${configuration.marketplace}/module/marketplace`, { headers }),
  ]);
  const indexerHeaders = { 'content-type': 'application/json', ...requestHeaders(process.env.APTOS_INDEXER_API_KEY) };
  const indexer = await verifiedFetch(process.env.APTOS_INDEXER_URL!, {
    method: 'POST', headers: indexerHeaders,
    body: JSON.stringify({ query: 'query VeytosDeploymentProbe { current_token_ownerships_v2(limit: 1) { last_transaction_version } }' }),
  }).then((response) => response.json()) as { errors?: unknown[] };
  assert(!indexer.errors?.length, 'Configured Aptos Indexer returned a GraphQL error');
  return { chainId: 2, launchpadModule: true, marketplaceModule: true, indexer: true };
}

try {
  const database = await verifyDatabase();
  const chain = databaseOnly ? null : await verifyChainDependencies();
  console.log(JSON.stringify({ ok: true, network: 'testnet', database, chain }, null, 2));
} finally {
  await pool.end();
}
