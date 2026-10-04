import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const buyer = `0x${'b'.repeat(64)}`;
const seller = `0x${'a'.repeat(64)}`;
const mocks = vi.hoisted(() => ({ wallet: { account: { address: { toString: () => buyer } } } }));
vi.mock('@aptos-labs/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }));
vi.mock('@/components/artwork', () => ({ Artwork: ({ name }: { name: string }) => <div aria-label={`${name} artwork`} /> }));
vi.mock('@/components/ui', () => ({ PriceDisplay: ({ octas }: { octas: string }) => <span>{octas} APT</span> }));
vi.mock('@/lib/config', () => ({ explorer: (_kind: string, value: string) => `https://explorer.test/${value}`, network: 'testnet', marketplaceAddress: '0xmarket' }));
import { MarketplaceCollectionTrading } from '../src/features/marketplace-collection';

const items = [
  { assetKey: 'listed', standard: 'v2' as const, name: 'Listed #1', metadataUri: '', owner: seller, listingId: '1', seller, price: '100000000', listedVersion: '20' },
  { assetKey: 'owned', standard: 'v2' as const, name: 'Owned #2', metadataUri: '', owner: buyer, listingId: null, seller: null, price: null, listedVersion: null },
];
const events = [{ event_type: 'PURCHASED' as const, listing_id: '1', standard: 'v2' as const, asset_key: 'listed', collection_key: 'v2:test', seller_address: seller, buyer_address: buyer, gross_price_octas: '100000000', transaction_hash: `0x${'c'.repeat(64)}`, transaction_version: '21', event_index: 0, chain_timestamp: '2026-10-04T00:00:00.000Z' }];

test('collection inventory defaults to listed and exposes owned items without inventing actions', () => {
  render(<MarketplaceCollectionTrading collectionKey="v2:test" items={items} events={events} inventoryFailed={false} activityFailed={false} />);
  expect(screen.getAllByText('Listed #1').length).toBeGreaterThan(0);
  expect(screen.queryByText('Owned #2')).toBeNull();
  fireEvent.click(screen.getAllByRole('radio', { name: /Owned by you/ })[0]);
  expect(screen.getAllByText('Owned #2').length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: 'List' })).toBeTruthy();
  expect(screen.queryByText(/offer/i)).toBeNull();
});

test('activity rail is one collapsible marketplace event stream', () => {
  render(<MarketplaceCollectionTrading collectionKey="v2:test" items={items} events={events} inventoryFailed={false} activityFailed={false} />);
  const panel = screen.getByText('MARKET EVENTS').closest('aside');
  expect(panel && within(panel).getByText(/Bought/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse activity panel' }));
  expect(screen.queryByText('MARKET EVENTS')).toBeNull();
  expect(sessionStorage.getItem('veytos:market:activity-collapsed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Expand activity panel' }));
  expect(screen.getByText('MARKET EVENTS')).toBeTruthy();
});

test('recent confirmed listing price remains visible while the durable projection catches up', async () => {
  localStorage.setItem('veytos:marketplace-snapshots:testnet:0xmarket', JSON.stringify([{
    assetKey: 'owned', collectionKey: 'v2:test', listingId: '9', seller: buyer, price: '125000000', listedVersion: '30',
    nft: { standard: 'v2', tokenId: 'owned', collectionId: 'test', name: 'Owned #2', metadataUri: '', collectionName: 'Test' },
  }]));
  render(<MarketplaceCollectionTrading collectionKey="v2:test" items={items} events={events} inventoryFailed={false} activityFailed={false} />);
  fireEvent.click(screen.getAllByRole('radio', { name: /All/ })[0]);
  expect(await screen.findByText('125000000 APT')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Manage' })).toBeTruthy();
  localStorage.clear();
});
