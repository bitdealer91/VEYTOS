import { afterEach,expect,test,vi } from 'vitest';
import { gatewayUrl,loadMetadata } from '../src/lib/metadata';
afterEach(()=>vi.unstubAllGlobals());
test('resolves IPFS, Arweave and HTTPS without changing canonical input',()=>{const cid='bafkreidi5cpywidu4jrh2yv64orlnfhcqfbs56ij5n5fkbpqpo773el4x4';expect(gatewayUrl(`ipfs://${cid}/test`)).toBe(`https://ipfs.io/ipfs/${cid}/test`);expect(gatewayUrl('ar://abc')).toBe('https://arweave.net/abc');expect(gatewayUrl('https://cdn.example/nft.json')).toBe('https://cdn.example/nft.json');expect(gatewayUrl('http://unsafe.example/x')).toBeNull();});
test('metadata parsing bounds text and resolves decentralized artwork',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({image:'ar://image',description:'x'.repeat(3000)}),{status:200})));const value=await loadMetadata('https://example.com/nft.json');expect(value.image).toBe('https://arweave.net/image');expect(value.description).toHaveLength(2048);});
test('malformed metadata fails safely',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('null',{status:200})));await expect(loadMetadata('https://example.com/nft.json')).rejects.toThrow('Metadata unavailable');});
