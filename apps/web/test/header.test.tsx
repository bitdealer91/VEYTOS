import { afterEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/explore', useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/wallet', () => ({ WalletButton: () => <button>Connect wallet</button> }));
vi.mock('@/components/artwork', () => ({ Artwork: ({ name }: { name: string }) => <span>{name} artwork</span> }));

import { AppHeader } from '../src/components/header';

afterEach(() => { vi.restoreAllMocks(); mocks.push.mockReset(); });

test('primary navigation stays focused on Launchpad and Marketplace', () => {
  render(<AppHeader />);
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Launchpad', 'Marketplace']);
  expect(within(navigation).queryByText('Activity')).toBeNull();
  expect(within(navigation).queryByText('Profile')).toBeNull();
  expect(screen.getByRole('combobox', { name: 'Search collections' })).toBeTruthy();
});

test('search shows Launchpad and Marketplace locations and opens a selected drop', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    launchpad: [{ area: 'launchpad', href: '/collection/0xdrop', address: '0xdrop', collection: '0xcollection', name: 'VEYTOS Originals', creator: '0x123', metadataUri: '', status: 'LIVE', minted: '4', supply: '100', price: '100000000' }],
    marketplace: [{ area: 'marketplace', href: '/explore/v2%3A0x123', key: 'v2:0x123', standard: 'v2', name: 'VEYTOS Originals', creator: '0x123', creatorName: 'VEYTOS', metadataUri: '', verified: true, native: true, floorPrice: '100000000', activeListings: '4' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  render(<AppHeader />);
  const search = screen.getByRole('combobox', { name: 'Search collections' });
  fireEvent.change(search, { target: { value: 'VEYTOS' } });
  expect(await screen.findAllByRole('option', { name: /VEYTOS Originals/ })).toHaveLength(2);
  expect([...screen.getByRole('listbox').querySelectorAll('.global-search-group')].map((group) => group.textContent)).toEqual(['Launchpad 1', 'Marketplace 1']);
  fireEvent.keyDown(search, { key: 'ArrowDown' });
  await waitFor(() => expect(screen.getAllByRole('option', { name: /VEYTOS Originals/ })[0].getAttribute('aria-selected')).toBe('true'));
  fireEvent.submit(search.closest('form')!);
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/collection/0xdrop'));
});

test('search submission keeps working when live suggestions fail', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  render(<AppHeader />);
  const search = screen.getByRole('combobox', { name: 'Search collections' });
  fireEvent.change(search, { target: { value: '0xabc' } });
  fireEvent.submit(search.closest('form')!);
  expect(mocks.push).toHaveBeenCalledWith('/search?q=0xabc');
});
