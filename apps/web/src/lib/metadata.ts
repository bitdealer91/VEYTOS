import { isIpfsUri } from '../../../../packages/domain/src/metadata';
import { config } from './config';
export function gatewayUrl(uri: string) {
  if(isIpfsUri(uri)){const gateway=new URL(config.NEXT_PUBLIC_IPFS_GATEWAY);if(gateway.protocol!=='https:')return null;return `${gateway.href.replace(/\/$/,'')}/${uri.slice(7)}`;}
  if(uri.startsWith('ar://')){const gateway=new URL(config.NEXT_PUBLIC_ARWEAVE_GATEWAY);if(gateway.protocol!=='https:')return null;return `${gateway.href.replace(/\/$/,'')}/${uri.slice(5)}`;}
  try{const url=new URL(uri);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
export async function loadMetadata(uri: string):Promise<{image:string|null;description:string|null}> {
  const url=gatewayUrl(uri);if(!url)throw new Error('Metadata unavailable');
  const response=await fetch(url,{signal:AbortSignal.timeout(6500),redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw new Error('Metadata unavailable');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try { while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)throw new Error('Metadata too large');chunks.push(value);} } finally {await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const data:unknown=JSON.parse(new TextDecoder().decode(bytes));
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Metadata unavailable');
  const record=data as Record<string,unknown>;
  return {image:typeof record.image==='string'?gatewayUrl(record.image):null,description:typeof record.description==='string'?record.description.slice(0,2048):null};
}
