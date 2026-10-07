import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { canonical } from '@veytos/aptos/domain';
import { projectMarketplaceTransaction } from '@veytos/aptos/marketplace-events';
import { aptosFetch,boundedInterval,launchpadEvents,nextTargetedVersion,retryDelay } from './indexer-runtime.ts';

const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, 'DATABASE_URL is required');
const network = process.env.APTOS_NETWORK;
assert(network === 'testnet' || network === 'mainnet' || network === 'devnet', 'APTOS_NETWORK is required');
const moduleAddress = canonical(process.env.MARKETPLACE_ADDRESS || '');
const endpoint = process.env.APTOS_FULLNODE_URL || `https://api.${network}.aptoslabs.com/v1`;
const launchpadAddress = process.env.LAUNCHPAD_ADDRESS ? canonical(process.env.LAUNCHPAD_ADDRESS) : null;
const apiKey=process.env.APTOS_API_KEY;
const indexerEndpoint=process.env.APTOS_INDEXER_URL||`https://api.${network}.aptoslabs.com/v1/graphql`;
const indexerApiKey=process.env.APTOS_INDEXER_API_KEY||apiKey;
const processor = `marketplace:${moduleAddress}`;
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
let stopping=false;process.once('SIGTERM',()=>{stopping=true;});process.once('SIGINT',()=>{stopping=true;});
const pageSize=100;
const targetedTransactionsQuery=`query VeytosTransactions($from: bigint!, $addresses: [String!]!, $limit: Int!) {
  user_transactions(where: {version: {_gte: $from}, entry_function_contract_address: {_in: $addresses}}, order_by: {version: asc}, limit: $limit) { version }
  processor_status(where: {processor: {_eq: "account_transactions_processor"}}, limit: 1) { last_success_version }
}`;

async function checkpoint(client: pg.PoolClient) {
  const result = await client.query<{ next_version: string }>(
    'SELECT next_version FROM indexer_checkpoints WHERE network=$1 AND processor=$2', [network, processor],
  );
  if (result.rows[0]) return BigInt(result.rows[0].next_version);
  const configured = process.env.BETA_INDEXER_START_VERSION || process.env.MARKETPLACE_START_VERSION;
  assert(configured && /^\d+$/.test(configured), 'BETA_INDEXER_START_VERSION is required for first run');
  return BigInt(configured);
}

async function targetedBatch(start:bigint,transactionInterval:number){
  const response=await aptosFetch(indexerEndpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:targetedTransactionsQuery,variables:{from:start.toString(),addresses:[moduleAddress,...(launchpadAddress?[launchpadAddress]:[])],limit:pageSize}})},indexerApiKey);
  if(!response.ok){const error=new Error(`Indexer transaction query failed: ${response.status}`) as Error&{response?:Response};error.response=response;throw error;}
  const body=await response.json() as {data?:{user_transactions?:Array<{version?:string|number}>,processor_status?:Array<{last_success_version?:string|number}>},errors?:Array<{message?:string}>};
  if(body.errors?.length)throw new Error(`Indexer transaction query failed: ${body.errors.map(error=>error.message||'GraphQL error').join('; ')}`);
  const rows=body.data?.user_transactions;
  const status=body.data?.processor_status?.[0]?.last_success_version;
  assert(Array.isArray(rows),'Indexer transaction query returned no rows');
  assert(status!==undefined&&/^\d+$/.test(String(status)),'Account transaction processor status is unavailable');
  const versions=rows.map(row=>{const value=String(row.version);assert(/^\d+$/.test(value),'Indexed transaction version is invalid');return BigInt(value);});
  for(let index=1;index<versions.length;index++)assert(versions[index]!>versions[index-1]!,'Indexed transaction versions are not strictly ordered');
  const transactions:unknown[]=[];
  for(const version of versions){
    const transactionResponse=await aptosFetch(`${endpoint}/transactions/by_version/${version}`,{},apiKey);
    if(!transactionResponse.ok){const error=new Error(`Fullnode transaction fetch failed: ${transactionResponse.status}`) as Error&{response?:Response};error.response=transactionResponse;throw error;}
    transactions.push(await transactionResponse.json());
    if(transactionInterval&&version!==versions.at(-1))await new Promise(resolve=>setTimeout(resolve,transactionInterval));
  }
  const indexedThrough=BigInt(String(status));
  return {transactions,next:nextTargetedVersion(start,versions,indexedThrough,pageSize),indexedThrough};
}

async function runBatch(transactionInterval:number) {
  const client = await pool.connect();
  let inTransaction=false;
  try {
    const start = await checkpoint(client);
    const batch=await targetedBatch(start,transactionInterval);
    await client.query('BEGIN');
    inTransaction=true;
    const transactions=batch.transactions;
    for (const transaction of transactions) {
      const tx = transaction as { version?: string; success?: boolean };
      assert(tx.version && /^\d+$/.test(tx.version), 'Transaction version missing');
      if(launchpadAddress)for(const event of launchpadEvents(transaction,launchpadAddress)){await client.query(`INSERT INTO launchpad_events(network,module_address,transaction_version,event_index,transaction_hash,event_type,payload,chain_timestamp) VALUES($1,$2,$3,$4,$5,$6,$7,to_timestamp($8::numeric/1000000)) ON CONFLICT DO NOTHING`,[network,launchpadAddress,event.version,event.eventIndex,event.hash,event.eventType,JSON.stringify(event.payload),event.timestamp]);}
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
      [network, processor, batch.next.toString()],
    );
    await client.query('COMMIT');
    inTransaction=false;
    return {count:transactions.length,start,next:batch.next,ledgerVersion:batch.indexedThrough};
  } catch (error) {
    if(inTransaction)await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const once=process.argv.includes('--once');
const pollInterval=boundedInterval(process.env.INDEXER_POLL_INTERVAL_MS,3000,1000,60_000);
const catchupInterval=boundedInterval(process.env.INDEXER_CATCHUP_INTERVAL_MS,1000,250,60_000);
const transactionInterval=boundedInterval(process.env.INDEXER_TRANSACTION_INTERVAL_MS,500,100,60_000);
const lockRetryInterval=boundedInterval(process.env.INDEXER_LOCK_RETRY_INTERVAL_MS,1000,250,10_000);
const lock=await pool.connect();
let lockAcquired=false;
try{
  while(!stopping&&!lockAcquired){
    const acquired=await lock.query<{locked:boolean}>('SELECT pg_try_advisory_lock(hashtext($1)) AS locked',[processor]);
    lockAcquired=acquired.rows[0]?.locked===true;
    if(!lockAcquired){
      console.log(JSON.stringify({event:'marketplace_indexer_lock_wait',processor,delayMs:lockRetryInterval}));
      await new Promise(resolve=>setTimeout(resolve,lockRetryInterval));
    }
  }
  if(lockAcquired){
    let failures=0;
    do{
      try{
        const batch=await runBatch(transactionInterval);failures=0;
        const lag=batch.ledgerVersion===null?null:(batch.ledgerVersion>=batch.next?batch.ledgerVersion-batch.next+1n:0n).toString();
        console.log(JSON.stringify({event:'marketplace_indexer_batch',processor,processed:batch.count,fromVersion:batch.start.toString(),nextVersion:batch.next.toString(),ledgerVersion:batch.ledgerVersion?.toString()||null,lag}));
        if(once)break;
        await new Promise(resolve=>setTimeout(resolve,batch.count?catchupInterval:pollInterval));
      }catch(error){
        if(once)throw error;
        const response=(error as {response?:Response}).response;
        const delayMs=retryDelay(response||null,failures++,pollInterval);
        console.error(JSON.stringify({event:'marketplace_indexer_retry',processor,status:response?.status||null,attempt:failures,delayMs,message:error instanceof Error?error.message:'Unknown indexer error'}));
        await new Promise(resolve=>setTimeout(resolve,delayMs));
      }
    }while(!stopping);
  }
}finally{
  if(lockAcquired)await lock.query('SELECT pg_advisory_unlock(hashtext($1))',[processor]);
  lock.release();await pool.end();
}
