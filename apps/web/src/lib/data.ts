import 'server-only';
import { cache } from 'react';
import { canonical } from '@veytos/aptos/domain';
import type { Activity, Drop } from '@veytos/aptos/types';
import { aptos, chain } from './chain';
import { network, packageAddress } from './config';
import { database } from './database';
import {readLaunchpadSnapshot} from './launchpad-read';
import {errorCategory} from './observability';
function entries(name: string, limit: number) { const list=(process.env[name]||'').split(',').map(s=>s.trim()).filter(Boolean); if(list.length>limit)throw new Error(`${name} exceeds ${limit}`); return [...new Set(list.map(canonical))]; }
export const discovery = cache(async () => {
  if (process.env.APTOS_NETWORK && process.env.APTOS_NETWORK !== network) throw new Error('Server/browser network mismatch');
  if (!packageAddress) return {drops:[] as Drop[], errors:0, configured:false};
  const featured=entries('VEYTOS_FEATURED_DROPS',20);const hidden=new Set<string>(entries('VEYTOS_HIDDEN_DROPS',20));const fallback=entries('VEYTOS_DISCOVERY_DROPS',20);const pool=database();let indexed:string[]=[];let projectionFailed=false;
  if(pool)try{const result=await pool.query<{drop:string}>(`SELECT DISTINCT payload->>'drop' AS drop FROM launchpad_events WHERE network=$1 AND module_address=$2 AND event_type='CollectionCreated' AND payload ? 'drop' ORDER BY drop LIMIT 100`,[network,packageAddress]);indexed=result.rows.map(row=>canonical(row.drop));}catch(error){projectionFailed=true;console.error(JSON.stringify({kind:'launchpad_optional_failure',network,package:packageAddress,module:'launchpad',upstream:'database',operation:'discovery',category:errorCategory(error,'database launchpad discovery'),fresh:false}));}
  const addresses=[...new Set([...featured,...indexed,...fallback])].filter(address=>!hidden.has(address));const results=await Promise.allSettled(addresses.map(a=>chain().drop(a)));
  const drops=results.flatMap(r=>r.status==='fulfilled' && r.value.finalized?[r.value]:[]);const featuredSet=new Set<string>(featured);
  return {drops,featured:drops.find(drop=>featuredSet.has(drop.address))??null,errors:results.filter(r=>r.status==='rejected').length+(projectionFailed?1:0),configured:!!pool||fallback.length>0};
});
export async function launchpadDetail(dropId:string){return readLaunchpadSnapshot({dropId,network,serverNetwork:process.env.APTOS_NETWORK,publicPackage:packageAddress??null,serverPackage:process.env.LAUNCHPAD_ADDRESS,read:()=>chain().eligibility(dropId)});}
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
export type LaunchpadMintActivity=Activity&{chainTimestamp:string|null};
export const launchpadActivityFor=cache(async(dropAddress:string):Promise<{events:LaunchpadMintActivity[];configured:boolean;failed:boolean}>=>{
  if(!packageAddress)return {events:[],configured:false,failed:false};
  const pool=database();
  if(!pool){const activity=await recordedActivity();return {events:activity.events.filter(event=>canonical(event.drop)===canonical(dropAddress)).slice(0,30).map(event=>({...event,chainTimestamp:null})),configured:false,failed:activity.failed};}
  try{
    const result=await pool.query<{payload:Activity;transaction_hash:string;transaction_version:string;chain_timestamp:Date|string}>(`SELECT payload,transaction_hash,transaction_version,chain_timestamp FROM launchpad_events WHERE network=$1 AND module_address=$2 AND event_type='NFTMinted' AND lpad(regexp_replace(lower(payload->>'drop'),'^0x',''),64,'0')=substring($3 from 3) ORDER BY transaction_version DESC,event_index DESC LIMIT 30`,[network,packageAddress,canonical(dropAddress)]);
    return {events:result.rows.map(row=>({...row.payload,hash:row.transaction_hash,version:row.transaction_version,chainTimestamp:new Date(row.chain_timestamp).toISOString()})),configured:true,failed:false};
  }catch(error){console.error(JSON.stringify({kind:'launchpad_optional_failure',network,package:packageAddress,module:'launchpad',drop:dropAddress,upstream:'database',operation:'mint_activity',category:errorCategory(error,'database mint activity'),fresh:false}));return {events:[],configured:true,failed:true};}
});
