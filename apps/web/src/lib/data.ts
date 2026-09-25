import 'server-only';
import { cache } from 'react';
import { canonical } from '@veytos/aptos/domain';
import type { Activity, Drop } from '@veytos/aptos/types';
import { aptos, chain } from './chain';
import { network, packageAddress } from './config';
function entries(name: string, limit: number) { const list=(process.env[name]||'').split(',').map(s=>s.trim()).filter(Boolean); if(list.length>limit)throw new Error(`${name} exceeds ${limit}`); return [...new Set(list.map(canonical))]; }
export const discovery = cache(async () => {
  if (process.env.APTOS_NETWORK && process.env.APTOS_NETWORK !== network) throw new Error('Server/browser network mismatch');
  if (!packageAddress) return {drops:[] as Drop[], errors:0, configured:false};
  const results=await Promise.allSettled(entries('VEYTOS_DISCOVERY_DROPS',20).map(a=>chain().drop(a)));
  return {drops:results.flatMap(r=>r.status==='fulfilled' && r.value.finalized?[r.value]:[]), errors:results.filter(r=>r.status==='rejected').length, configured:true};
});
export const recordedActivity = cache(async ():Promise<{events:Activity[];failed:boolean}> => {
  if(!packageAddress)return {events:[],failed:false};
  const result=await Promise.allSettled(entries('VEYTOS_ACTIVITY_TXS',30).map(async hash=> {
    const tx=await aptos.getTransactionByHash({transactionHash:hash});
    if(tx.type!=='user_transaction'||!tx.success)return [];
    return chain().events(tx).map(e=>({...e,hash:tx.hash,version:tx.version}));
  }));
  return {events:result.flatMap(r=>r.status==='fulfilled'?r.value:[]).sort((a,b)=>Number(BigInt(b.version)-BigInt(a.version))),failed:result.some(r=>r.status==='rejected')};
});
