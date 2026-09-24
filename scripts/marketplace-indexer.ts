import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { canonical } from '@veytos/aptos/domain';
import { projectMarketplaceTransaction } from '@veytos/aptos/marketplace-events';

const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, 'DATABASE_URL is required');
const network = process.env.APTOS_NETWORK;
assert(network === 'testnet' || network === 'mainnet' || network === 'devnet', 'APTOS_NETWORK is required');
const moduleAddress = canonical(process.env.MARKETPLACE_ADDRESS || '');
const endpoint = process.env.APTOS_FULLNODE_URL || `https://api.${network}.aptoslabs.com/v1`;
const processor = `marketplace:${moduleAddress}`;
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

async function checkpoint(client: pg.PoolClient) {
  const result = await client.query<{ next_version: string }>(
    'SELECT next_version FROM indexer_checkpoints WHERE network=$1 AND processor=$2', [network, processor],
  );
  if (result.rows[0]) return BigInt(result.rows[0].next_version);
  const configured = process.env.MARKETPLACE_START_VERSION;
  assert(configured && /^\d+$/.test(configured), 'MARKETPLACE_START_VERSION is required for first run');
  return BigInt(configured);
}

async function runBatch() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const start = await checkpoint(client);
    const response = await fetch(`${endpoint}/transactions?start=${start}&limit=100`);
    if (!response.ok) throw new Error(`Fullnode transaction fetch failed: ${response.status}`);
    const transactions = await response.json() as unknown[];
    let next = start;
    for (const transaction of transactions) {
      const tx = transaction as { version?: string; success?: boolean };
      assert(tx.version && /^\d+$/.test(tx.version), 'Transaction version missing');
      next = BigInt(tx.version) + 1n;
      for (const event of projectMarketplaceTransaction(transaction, moduleAddress)) {
        const inserted = await client.query(
          `INSERT INTO marketplace_events
           (network,module_address,transaction_version,event_index,transaction_hash,listing_id,event_type,standard,asset_key,collection_key,seller_address,buyer_address,gross_price_octas,payload,chain_timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,to_timestamp($15))
           ON CONFLICT DO NOTHING`,
          [network,moduleAddress,event.version,event.eventIndex,event.hash,event.listingId,event.eventType,event.standard,event.assetKey,event.collectionKey,event.seller,event.buyer,event.grossPrice,JSON.stringify(event.payload),event.timestamp],
        );
        if (inserted.rowCount === 0) continue;
        if (event.eventType === 'LISTED') {
          const data = event.payload as Record<string, string>;
          await client.query(
            `INSERT INTO marketplace_listings
             (network,module_address,listing_id,standard,asset_key,collection_key,seller_address,price_octas,fee_bps,storage_reimbursement_octas,royalty_payee,royalty_numerator,royalty_denominator,status,listed_version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE',$14)
             ON CONFLICT (network,module_address,listing_id) DO NOTHING`,
            [network,moduleAddress,event.listingId,event.standard,event.assetKey,event.collectionKey,event.seller,String(data.gross_price),String(data.fee_bps),String(data.storage_reimbursement),canonical(String(data.royalty_payee)),String(data.royalty_numerator),String(data.royalty_denominator),event.version],
          );
        } else {
          const terminal = event.eventType === 'PURCHASED' ? 'SOLD' : 'CANCELLED';
          const updated = await client.query(
            `UPDATE marketplace_listings SET status=$1,buyer_address=$2,terminal_version=$3,updated_at=now()
             WHERE network=$4 AND module_address=$5 AND listing_id=$6 AND status='ACTIVE'`,
            [terminal,event.buyer,event.version,network,moduleAddress,event.listingId],
          );
          assert.equal(updated.rowCount, 1, `Missing or terminal listing ${event.listingId}`);
        }
      }
    }
    await client.query(
      `INSERT INTO indexer_checkpoints(network,processor,next_version) VALUES($1,$2,$3)
       ON CONFLICT(network,processor) DO UPDATE SET next_version=EXCLUDED.next_version,updated_at=now()`,
      [network, processor, next.toString()],
    );
    await client.query('COMMIT');
    return transactions.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  const count = await runBatch();
  console.log(`Processed ${count} transactions for ${processor}`);
} finally {
  await pool.end();
}
