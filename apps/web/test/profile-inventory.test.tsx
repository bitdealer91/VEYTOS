import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { encodeNFTIdentity } from '@veytos/aptos/marketplace';

const seller = `0x${'a'.repeat(64)}`;
const token = `0x${'b'.repeat(64)}`;
const collection = `0x${'c'.repeat(64)}`;
const assetKey = encodeNFTIdentity({ standard: 'v2', address: token });
const mocks = vi.hoisted(() => ({
  assetState: vi.fn(),
  wallet: { account: { address: { toString: () => seller } } },
}));

vi.mock('@aptos-labs/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }));
vi.mock('@/lib/chain', () => ({ marketChain: () => ({ assetState: mocks.assetState }) }));
vi.mock('@/lib/config', () => ({ config: {}, marketplaceAddress: '0xmarket', network: 'testnet' }));
vi.mock('@/components/artwork', () => ({ Artwork: ({ name }: { name: string }) => <div aria-label={`${name} artwork`} /> }));
vi.mock('@/components/ui', () => ({ EmptyState: ({ title }: { title: string }) => <div>{title}</div>, PriceDisplay: ({ octas }: { octas: string }) => <span>{octas}</span> }));

import { ProfileInventory } from '../src/components/profile-inventory';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test('a sold session listing is removed before profile exposes Manage', async () => {
  localStorage.setItem('veytos:marketplace-snapshots:testnet:0xmarket', JSON.stringify([{
    assetKey, collectionKey: `v2:${collection}`, listingId: '9', seller, price: '200000000', listedVersion: '20',
    nft: { standard: 'v2', tokenId: token, collectionId: collection, name: 'RONGS #002', metadataUri: '', collectionName: 'RONGS' },
  }]));
  mocks.assetState.mockResolvedValue({ listing: null, owner: `0x${'d'.repeat(64)}`, ledgerVersion: '30' });
  render(<ProfileInventory owned={[]} listings={[]} profileAddress={seller} />);
  expect(screen.queryByRole('link', { name: 'Manage' })).toBe(null);
  await waitFor(() => expect(JSON.parse(localStorage.getItem('veytos:marketplace-snapshots:testnet:0xmarket') || '[]')).toEqual([]));
  expect(screen.getByText('No supported NFTs found')).toBeTruthy();
});

test('an active session listing remains manageable while durable indexing catches up', async () => {
  localStorage.setItem('veytos:marketplace-snapshots:testnet:0xmarket', JSON.stringify([{
    assetKey, collectionKey: `v2:${collection}`, listingId: '9', seller, price: '200000000', listedVersion: '20',
    nft: { standard: 'v2', tokenId: token, collectionId: collection, name: 'RONGS #002', metadataUri: '', collectionName: 'RONGS' },
  }]));
  mocks.assetState.mockResolvedValue({ listing: { id: '9', seller, status: 'ACTIVE', price: '200000000' }, owner: `0x${'e'.repeat(64)}`, ledgerVersion: '21' });
  render(<ProfileInventory owned={[]} listings={[]} profileAddress={seller} />);
  expect(await screen.findByRole('link', { name: 'Manage' })).toBeTruthy();
  expect(screen.getByText('200000000')).toBeTruthy();
});
