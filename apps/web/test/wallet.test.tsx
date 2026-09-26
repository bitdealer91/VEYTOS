import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const address = `0x${'a'.repeat(64)}`;
const mocks = vi.hoisted(() => ({
  wallet: {
    connected: true,
    account: { address: { toString: () => address } },
    wallets: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  clear: vi.fn(),
}));

vi.mock('@aptos-labs/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }));
vi.mock('@/components/providers', () => ({ useWalletError: () => ({ message: '', clear: mocks.clear }) }));
vi.mock('@/components/beta-analytics', () => ({ trackBetaEvent: vi.fn() }));
vi.mock('@/lib/observability', () => ({ reportClientError: vi.fn() }));

import { WalletButton } from '../src/components/wallet';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallet.connected = true;
  mocks.wallet.account = { address: { toString: () => address } };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

test('connected wallet owns profile, copy, explorer, and disconnect actions', async () => {
  render(<WalletButton />);
  fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
  expect(screen.getByRole('menu')).toBeTruthy();
  expect(screen.getByRole('menuitem', { name: 'Profile' }).getAttribute('href')).toBe(`/profile/${address}`);
  expect(screen.getByRole('menuitem', { name: 'View on Explorer' }).getAttribute('href')).toContain(address);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy address' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnect' }));
  await waitFor(() => expect(mocks.wallet.disconnect).toHaveBeenCalledOnce());
});

test('connected wallet account menu closes with Escape', () => {
  render(<WalletButton />);
  fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
});
