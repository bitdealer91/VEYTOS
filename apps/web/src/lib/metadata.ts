import { isIpfsUri } from '../../../../packages/domain/src/metadata';
import { config } from './config';
export function gatewayUrl(uri: string) {
  if(!isIpfsUri(uri))return null;
  const gateway=new URL(config.NEXT_PUBLIC_IPFS_GATEWAY);
  if(gateway.protocol!=='https:')return null;
  return `${gateway.href.replace(/\/$/,'')}/${uri.slice(7)}`;
}
export async function loadMetadata(uri: string):Promise<{image:string|null;description:string|null}> {
  const url=gatewayUrl(uri);if(!url)throw new Error('Metadata unavailable');
  const response=await fetch(url,{signal:AbortSignal.timeout(6500),redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw new Error('Metadata unavailable');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try { while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)throw new Error('Metadata too large');chunks.push(value);} } finally {await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const data=JSON.parse(new TextDecoder().decode(bytes));
  return {image:typeof data.image==='string'?gatewayUrl(data.image):null,description:typeof data.description==='string'?data.description.slice(0,2048):null};
}
