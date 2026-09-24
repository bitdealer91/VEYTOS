import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NormalizedNFT } from '@veytos/aptos/discovery';
import type { MarketplaceConfig, MarketplaceListing, PendingMarketplaceTransaction } from '@veytos/aptos/types';

const seller = `0x${'a'.repeat(64)}`;
const buyer = `0x${'b'.repeat(64)}`;
const token = `0x${'c'.repeat(64)}`;
const collection = `0x${'d'.repeat(64)}`;
const moduleAddress = '0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb';
const mocks = vi.hoisted(() => ({
  wallet: { connected: true, account: { address: { toString: () => seller } }, network: { chainId: 2 }, signAndSubmitTransaction: vi.fn() },
  config: vi.fn(), eligibility: vi.fn(), reconcile: vi.fn(), listPayload: vi.fn(), cancelPayload: vi.fn(), buyPayload: vi.fn(),
}));
vi.mock('@aptos-labs/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }));
vi.mock('@/lib/chain', () => ({ marketChain: () => mocks }));
vi.mock('@/components/wallet', () => ({ WalletButton: () => <button>Connect wallet</button> }));
import { MarketplacePanel } from '../src/features/marketplace-panel';

const config: MarketplaceConfig = { chainId: 2, feeBps: '200', recipient: `0x${'e'.repeat(64)}`, globalPaused: false, v1Paused: false, v2Paused: false, admin: `0x${'f'.repeat(64)}`, v1StorageReimbursement: '800000', v2StorageReimbursement: '926400' };
const nft: NormalizedNFT = { standard: 'v2', identity: { standard: 'v2', address: token }, tokenId: token, collectionId: collection, owner: seller, amount: '1', name: 'Verified NFT', description: '', metadataUri: '', image: null, collectionName: 'Verified collection', collectionCreator: seller, collectionMetadataUri: '', lastTransactionVersion: '1', maximum: null, properties: null, royalty: null, isSoulbound: false };
const listing: MarketplaceListing = { id: '9', seller, standard: 'v2', identity: nft.identity, collectionId: collection, price: '1000000000', feeBps: '200', storageReimbursement: '926400', royaltyPayee: seller, royaltyNumerator: '750', royaltyDenominator: '10000', status: 'ACTIVE' };
const key = `${'veytos:market:testnet'}:${moduleAddress}:9:${token}:`;

function mount(asset = nft, active: MarketplaceListing | null = null, initialConfig = config) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MarketplacePanel nft={asset} initialListing={active} initialConfig={initialConfig} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.wallet.connected = true; mocks.wallet.account.address.toString = () => seller; mocks.wallet.network.chainId = 2;
  mocks.config.mockResolvedValue(config); mocks.eligibility.mockResolvedValue({ eligible: true, reasons: [], royalty: { payee: seller, numerator: '750', denominator: '10000' } });
  mocks.listPayload.mockReturnValue({ function: `${moduleAddress}::settlement_v2::list`, functionArguments: [] });
});

test('listing review shows exact fee, royalty, proceeds and storage reimbursement', async () => {
  mount(); fireEvent.change(screen.getByLabelText('Price in APT'), { target: { value: '10' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Review listing' }));
  const dialog = screen.getByRole('dialog'); expect(dialog.textContent).toContain('0.2'); expect(dialog.textContent).toContain('0.75'); expect(dialog.textContent).toContain('9.05'); expect(dialog.textContent).toContain('0.009264');
});

test('unsupported NFT fails closed with a readable reason', async () => {
  mocks.eligibility.mockResolvedValue({ eligible: false, reasons: ['This Digital Asset collection has not passed VEYTOS custody review.'], royalty: null });
  mount(); expect(await screen.findByText(/has not passed VEYTOS custody review/)).toBeTruthy(); expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(true);
});

test('pause blocks a new listing but keeps seller cancellation available', async () => {
  const paused = { ...config, globalPaused: true }; mocks.config.mockResolvedValue(paused);
  const first = mount(nft, null, paused); expect(await screen.findByText(/temporarily paused/)).toBeTruthy(); expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(true);
  first.unmount(); mount(nft, listing, paused); expect(screen.getByRole('button', { name: 'Cancel listing' }).hasAttribute('disabled')).toBe(false);
});

test('wrong network prevents all trading review actions', async () => {
  mocks.wallet.network.chainId = 1; mount(); expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Switch your wallet to Aptos testnet')); expect(screen.queryByRole('button', { name: 'Review listing' })).toBe(null);
});

test('buyer review exposes expected total before gas', () => {
  mocks.wallet.account.address.toString = () => buyer; mount(nft, listing); fireEvent.click(screen.getByRole('button', { name: 'Buy now' })); const dialog = screen.getByRole('dialog'); expect(dialog.textContent).toContain('10.009264'); expect(dialog.textContent).toContain('Storage reimbursement');
});

test('interrupted no-hash request never retries automatically', async () => {
  const pending: PendingMarketplaceTransaction = { action: 'buy', hash: '', sender: buyer, listingId: '9', identity: nft.identity, expectedPrice: listing.price, expectedStorageReimbursement: listing.storageReimbursement, network: 'testnet', module: moduleAddress };
  localStorage.setItem(key, JSON.stringify(pending)); mocks.wallet.account.address.toString = () => buyer; mount(nft, listing);
  expect(await screen.findByText(/wallet request was interrupted/)).toBeTruthy(); expect(mocks.wallet.signAndSubmitTransaction).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Clear unsubmitted request' }).hasAttribute('disabled')).toBe(true);
});

test('known pending hash reconciles without submitting another transaction', async () => {
  const hash = `0x${'1'.repeat(64)}`; const pending: PendingMarketplaceTransaction = { action: 'buy', hash, sender: buyer, listingId: '9', identity: nft.identity, expectedPrice: listing.price, expectedStorageReimbursement: listing.storageReimbursement, network: 'testnet', module: moduleAddress };
  localStorage.setItem(key, JSON.stringify(pending)); mocks.wallet.account.address.toString = () => buyer; mocks.reconcile.mockResolvedValue({ status: 'success', listing: { ...listing, status: 'SOLD' } }); mount(nft, listing);
  fireEvent.click(await screen.findByRole('button', { name: 'Check transaction status' })); await screen.findByText(/Purchase verified/); expect(mocks.wallet.signAndSubmitTransaction).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBe(null);
});

test('failed reconciliation is terminal and clears the pending record', async () => {
  const hash = `0x${'2'.repeat(64)}`; const pending: PendingMarketplaceTransaction = { action: 'cancel', hash, sender: seller, listingId: '9', identity: nft.identity, network: 'testnet', module: moduleAddress };
  localStorage.setItem(key, JSON.stringify(pending)); mocks.reconcile.mockResolvedValue({ status: 'failed', message: 'EPRICE_CHANGED' }); mount(nft, listing);
  fireEvent.click(await screen.findByRole('button', { name: 'Check transaction status' })); await screen.findByText(/did not match your reviewed price/); expect(localStorage.getItem(key)).toBe(null);
});
