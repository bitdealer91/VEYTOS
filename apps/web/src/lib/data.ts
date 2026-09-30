import 'server-only';
import { cache } from 'react';
import { canonical } from '@veytos/aptos/domain';
import type { Activity, Drop } from '@veytos/aptos/types';
import { aptos, chain } from './chain';
import { network, packageAddress } from './config';
import { database } from './database';
function entries(name: string, limit: number) { const list=(process.env[name]||'').split(',').map(s=>s.trim()).filter(Boolean); if(list.length>limit)throw new Error(`${name} exceeds ${limit}`); return [...new Set(list.map(canonical))]; }
export const discovery = cache(async () => {
  if (process.env.APTOS_NETWORK && process.env.APTOS_NETWORK !== network) throw new Error('Server/browser network mismatch');
  if (!packageAddress) return {drops:[] as Drop[], errors:0, configured:false};
  const featured=entries('VEYTOS_FEATURED_DROPS',20);const hidden=new Set<string>(entries('VEYTOS_HIDDEN_DROPS',20));const fallback=entries('VEYTOS_DISCOVERY_DROPS',20);const pool=database();let indexed:string[]=[];let projectionFailed=false;
  if(pool)try{const result=await pool.query<{drop:string}>(`SELECT DISTINCT payload->>'drop' AS drop FROM launchpad_events WHERE network=$1 AND module_address=$2 AND event_type='CollectionCreated' AND payload ? 'drop' ORDER BY drop LIMIT 100`,[network,packageAddress]);indexed=result.rows.map(row=>canonical(row.drop));}catch{projectionFailed=true;}
  const addresses=[...new Set([...featured,...indexed,...fallback])].filter(address=>!hidden.has(address));const results=await Promise.allSettled(addresses.map(a=>chain().drop(a)));
  return {drops:results.flatMap(r=>r.status==='fulfilled' && r.value.finalized?[r.value]:[]), errors:results.filter(r=>r.status==='rejected').length+(projectionFailed?1:0), configured:!!pool||fallback.length>0};
});
export const recordedActivity = cache(async ():Promise<{events:Activity[];failed:boolean}> => {
  if(!packageAddress)return {events:[],failed:false};
  const pool=database();if(pool){try{const result=await pool.query<{payload:Activity;transaction_hash:string;transaction_version:string}>(`SELECT payload,transaction_hash,transaction_version FROM launchpad_events WHERE network=$1 AND module_address=$2 AND event_type='NFTMinted' ORDER BY transaction_version DESC,event_index DESC LIMIT 100`,[network,packageAddress]);return {events:result.rows.map(row=>({...row.payload,hash:row.transaction_hash,version:row.transaction_version})),failed:false};}catch{return {events:[],failed:true};}}
  const result=await Promise.allSettled(entries('VEYTOS_ACTIVITY_TXS',30).map(async hash=> {
    const tx=await aptos.getTransactionByHash({transactionHash:hash});
    if(tx.type!=='user_transaction'||!tx.success)return [];
    return chain().events(tx).map(e=>({...e,hash:tx.hash,version:tx.version}));
  }));
  return {events:result.flatMap(r=>r.status==='fulfilled'?r.value:[]).sort((a,b)=>Number(BigInt(b.version)-BigInt(a.version))),failed:result.some(r=>r.status==='rejected')};
});
