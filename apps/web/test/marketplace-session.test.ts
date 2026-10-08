import { beforeEach, expect, test } from 'vitest';
import {
  readMarketplaceSession, readMarketplaceTerminals, writeMarketplaceSession, writeMarketplaceTerminal,
} from '../src/lib/marketplace-session';

const network = 'testnet';
const moduleAddress = '0xmarket';
const assetKey = 'asset';
const collectionKey = 'v2:collection';
const listing = {
  assetKey, collectionKey, listingId: '7', seller: '0xseller', price: '100000000', listedVersion: '20',
  nft: { standard: 'v2' as const, tokenId: '0xtoken', collectionId: '0xcollection', name: 'RONGS #007', metadataUri: '', collectionName: 'RONGS' },
};

beforeEach(() => localStorage.clear());

test('terminal marketplace state removes an optimistic active listing', () => {
  writeMarketplaceSession(network, moduleAddress, listing, assetKey);
  writeMarketplaceTerminal(network, moduleAddress, { assetKey, collectionKey, transactionVersion: '30', owner: '0xbuyer', status: 'SOLD' });
  expect(readMarketplaceSession(network, moduleAddress)).toEqual([]);
  expect(readMarketplaceTerminals(network, moduleAddress)).toEqual([
    { assetKey, collectionKey, transactionVersion: '30', owner: '0xbuyer', status: 'SOLD' },
  ]);
});

test('a newer listing clears the prior terminal state', () => {
  writeMarketplaceTerminal(network, moduleAddress, { assetKey, collectionKey, transactionVersion: '30', owner: '0xbuyer', status: 'SOLD' });
  writeMarketplaceSession(network, moduleAddress, { ...listing, listedVersion: '40', seller: '0xbuyer' }, assetKey);
  expect(readMarketplaceTerminals(network, moduleAddress)).toEqual([]);
  expect(readMarketplaceSession(network, moduleAddress)[0]?.listedVersion).toBe('40');
});
