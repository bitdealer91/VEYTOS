import type {Drop} from '@veytos/aptos/types';
import {canonical} from '@veytos/aptos/domain';
import {errorCategory} from './observability';

export type LaunchpadSnapshot={drop:Drop;now:string;chainId:number;paused:boolean;walletMinted:string};
export type LaunchpadReadFailure='configuration'|'network_mismatch'|'package_mismatch'|'malformed_chain_response'|'stale_chain_state'|'rpc_unavailable';
export type LaunchpadReadResult={ok:true;snapshot:LaunchpadSnapshot;requestId:string}|{ok:false;reason:LaunchpadReadFailure;requestId:string};

export async function readLaunchpadSnapshot({
  dropId,network,serverNetwork,publicPackage,serverPackage,read,nowSeconds=BigInt(Math.floor(Date.now()/1000)),requestId=crypto.randomUUID(),maxLedgerLagSeconds=120n,
}:{dropId:string;network:string;serverNetwork?:string;publicPackage:string|null;serverPackage?:string;read:()=>Promise<LaunchpadSnapshot>;nowSeconds?:bigint;requestId?:string;maxLedgerLagSeconds?:bigint}):Promise<LaunchpadReadResult>{
  const fail=(reason:LaunchpadReadFailure,error?:unknown)=>{console.error(JSON.stringify({kind:'launchpad_read_failure',requestId,network,package:publicPackage,module:'launchpad',drop:dropId,upstream:reason==='rpc_unavailable'?'fullnode':'configuration',category:error?errorCategory(error,'launchpad authoritative read'):reason,fresh:false}));return {ok:false as const,reason,requestId};};
  if(!publicPackage)return fail('configuration');
  if(serverNetwork&&serverNetwork!==network)return fail('network_mismatch');
  try{if(serverPackage&&canonical(serverPackage)!==canonical(publicPackage))return fail('package_mismatch');}catch(error){return fail('package_mismatch',error);}
  try{
    const snapshot=await read();
    if(snapshot.chainId!==({testnet:2,mainnet:1,devnet:34} as Record<string,number>)[network])return fail('network_mismatch');
    if(canonical(snapshot.drop.address)!==canonical(dropId)||!snapshot.drop.finalized)return fail('malformed_chain_response');
    const ledgerSeconds=BigInt(snapshot.now);
    if(ledgerSeconds>nowSeconds+30n||nowSeconds-ledgerSeconds>maxLedgerLagSeconds)return fail('stale_chain_state');
    return {ok:true,snapshot,requestId};
  }catch(error){
    const category=errorCategory(error,'launchpad authoritative fullnode');
    return fail(category==='rpc_unavailable'||category==='rpc_rate_limit'?'rpc_unavailable':'malformed_chain_response',error);
  }
}
