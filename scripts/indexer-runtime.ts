export function requestHeaders(apiKey?:string){return apiKey?{Authorization:`Bearer ${apiKey}`}:{ } as Record<string,string>;}
export function retryDelay(response:Pick<Response,'status'|'headers'>|null,attempt:number,baseMs:number){
  const header=response?.headers.get('retry-after');if(header&&/^\d+$/.test(header))return Math.min(60_000,Number(header)*1000);
  const bounded=Math.min(4,Math.max(0,attempt));return Math.min(30_000,baseMs*(2**bounded));
}
export function launchpadEvents(transaction:unknown,moduleAddress:string){
  const tx=transaction as {type?:string;success?:boolean;version?:string;hash?:string;timestamp?:string;events?:Array<{type?:string;data?:unknown}>};
  if(tx.type!=='user_transaction'||!tx.success||!tx.version||!tx.hash||!tx.timestamp)return [];
  const prefix=`${moduleAddress}::launchpad::`;
  return (tx.events||[]).flatMap((event,eventIndex)=>event.type?.startsWith(prefix)?[{version:tx.version,hash:tx.hash,timestamp:tx.timestamp,eventIndex,eventType:event.type.slice(prefix.length),payload:event.data}]:[]);
}
