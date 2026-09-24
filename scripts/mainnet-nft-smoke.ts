import assert from 'node:assert/strict';
import { makeAptos } from '../packages/aptos/src/client.ts';
import { discoverOwnedNFTs } from '../packages/aptos/src/discovery.ts';

const wallet = '0x0f3f84a5fbec5473ca5ee4b4b69a56d480951c89084a9127d1129059137238d1';
const pontemCreator = '0xc46dd298b89d38314b486b2182a6163c4c955dce3509bf30751c307f5ecc2f36';
const pontemCollection = '0xaece05d29c0b543be608d73c44d8bb46a09e18e06097f7fdec078689e52ed118';

const result = await discoverOwnedNFTs(makeAptos('mainnet'), wallet);
const pirate = result.items.find((item) =>
  item.standard === 'v1' &&
  item.collectionName === 'Pontem Space Pirates' &&
  item.collectionCreator === pontemCreator &&
  item.collectionId === pontemCollection
);

assert.ok(result.items.some((item) => item.standard === 'v1'), 'expected a Token V1 asset');
assert.ok(result.items.some((item) => item.standard === 'v2'), 'expected a Token V2 asset');
assert.ok(pirate, 'expected a canonical Pontem Space Pirates asset');

console.log(JSON.stringify({
  network: 'mainnet',
  wallet,
  pages: result.pages,
  count: result.items.length,
  rejectedRows: result.rejectedRows,
  standards: [...new Set(result.items.map((item) => item.standard))],
  historicalCollection: {
    name: pirate.collectionName,
    creator: pirate.collectionCreator,
    collectionId: pirate.collectionId,
    token: pirate.name,
    identity: pirate.identity,
  },
}, null, 2));
