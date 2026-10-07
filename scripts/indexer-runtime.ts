export function requestHeaders(apiKey?:string){return apiKey?{Authorization:`Bearer ${apiKey}`}:{ } as Record<string,string>;}
export async function aptosFetch(
  input:string,
  init:RequestInit={},
  apiKey?:string,
  fetcher:typeof fetch=fetch,
){
  const headers=new Headers(init.headers);
  if(apiKey)headers.set('Authorization',`Bearer ${apiKey}`);
  const response=await fetcher(input,{...init,headers});
  if(!apiKey||![401,403,429].includes(response.status))return response;
  return fetcher(input,{...init,headers:new Headers(init.headers)});
}
export function retryDelay(response:Pick<Response,'status'|'headers'>|null,attempt:number,baseMs:number){
  const header=response?.headers.get('retry-after');
  if(header){
    if(/^\d+$/.test(header))return Math.min(60_000,Number(header)*1000);
    const retryAt=Date.parse(header);if(Number.isFinite(retryAt))return Math.min(60_000,Math.max(baseMs,retryAt-Date.now()));
  }
  const bounded=Math.min(4,Math.max(0,attempt));return Math.min(30_000,baseMs*(2**bounded));
}
export function boundedInterval(value:string|undefined,fallback:number,min:number,max:number){
  const parsed=Number(value);return Number.isFinite(parsed)?Math.min(max,Math.max(min,Math.trunc(parsed))):fallback;
}
export function nextTargetedVersion(start:bigint,versions:bigint[],indexedThrough:bigint,pageSize:number){
  if(versions.length>=pageSize){const last=versions.at(-1);return last===undefined?start:last+1n;}
  return indexedThrough>=start?indexedThrough+1n:start;
}
export function launchpadEvents(transaction:unknown,moduleAddress:string){
  const tx=transaction as {type?:string;success?:boolean;version?:string;hash?:string;timestamp?:string;events?:Array<{type?:string;data?:unknown}>};
  if(tx.type!=='user_transaction'||!tx.success||!tx.version||!tx.hash||!tx.timestamp)return [];
  const prefix=`${moduleAddress}::launchpad::`;
  return (tx.events||[]).flatMap((event,eventIndex)=>event.type?.startsWith(prefix)?[{version:tx.version,hash:tx.hash,timestamp:tx.timestamp,eventIndex,eventType:event.type.slice(prefix.length),payload:event.data}]:[]);
}
