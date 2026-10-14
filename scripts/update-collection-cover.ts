import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { CID } from 'multiformats/cid';

const [coverArgument, metadataArgument] = process.argv.slice(2);
assert(coverArgument, 'Usage: update-collection-cover.ts <cover.gif> <current-metadata-ipfs-uri>');
if (!metadataArgument?.startsWith('ipfs://')) throw new Error('Current metadata must be an ipfs:// URI');

const coverPath = resolve(coverArgument);
assert((await stat(coverPath)).isFile(), 'Collection cover is not a file');
const cover = new Uint8Array(await readFile(coverPath));
assert(['GIF87a', 'GIF89a'].includes(Buffer.from(cover.subarray(0, 6)).toString('ascii')), 'Collection cover must be a GIF');

const apiKeyPath = resolve(process.env.LIGHTHOUSE_API_KEY_FILE || resolve(homedir(), 'Downloads/Apikey.txt'));
const apiKey = (await readFile(apiKeyPath, 'utf8')).trim();
assert(/^[A-Za-z0-9._-]{20,}$/.test(apiKey), 'Unexpected Lighthouse API key format');

const upload = async (bytes: Uint8Array, name: string, contentType: string) => {
  const form = new FormData();
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append('file', new Blob([body], { type: contentType }), name);
  const response = await fetch('https://upload.lighthouse.storage/api/v0/add', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`Lighthouse upload failed: HTTP ${response.status} ${await response.text()}`);
  const result = await response.json() as { Hash?: string; data?: { Hash?: string } };
  const cid = result.data?.Hash || result.Hash;
  assert(cid, 'Lighthouse did not return a CID');
  CID.parse(cid);
  return cid;
};

const currentCid = metadataArgument.slice(7);
CID.parse(currentCid);
const currentResponse = await fetch(`https://gateway.lighthouse.storage/ipfs/${currentCid}`, {
  signal: AbortSignal.timeout(30_000), redirect: 'error',
});
assert(currentResponse.ok, `Current metadata fetch failed: HTTP ${currentResponse.status}`);
const metadata = await currentResponse.json() as Record<string, unknown>;
assert(metadata && typeof metadata === 'object' && !Array.isArray(metadata), 'Current metadata is invalid');

const coverCid = await upload(cover, basename(coverPath), 'image/gif');
const updatedMetadata = { ...metadata, image: `ipfs://${coverCid}` };
const metadataCid = await upload(new TextEncoder().encode(JSON.stringify(updatedMetadata)), 'collection.json', 'application/json');

console.log(JSON.stringify({
  cover: `ipfs://${coverCid}`,
  metadata: `ipfs://${metadataCid}`,
}, null, 2));
