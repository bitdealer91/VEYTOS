import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NormalizedNFT } from '@veytos/aptos/discovery';
import type { MarketplaceConfig, MarketplaceListing, PendingMarketplaceTransaction } from '@veytos/aptos/types';

const seller = `0x${'a'.repeat(64)}`;
const buyer = `0x${'b'.repeat(64)}`;
const token = `0x${'c'.repeat(64)}`;
const collection = `0x${'d'.repeat(64)}`;
const moduleAddress = '0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb';
const mocks = vi.hoisted(() => ({
  wallet: { connected: true, account: { address: { toString: () => seller } }, network: { chainId: 2 }, signAndSubmitTransaction: vi.fn() },
  config: vi.fn(), assetState: vi.fn(), eligibility: vi.fn(), reconcile: vi.fn(), listPayload: vi.fn(), cancelPayload: vi.fn(), buyPayload: vi.fn(),
}));
vi.mock('@aptos-labs/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/chain', () => ({ marketChain: () => mocks }));
vi.mock('@/components/wallet', () => ({ WalletButton: () => <button>Connect wallet</button> }));
import { MarketplacePanel } from '../src/features/marketplace-panel';

const config: MarketplaceConfig = { chainId: 2, feeBps: '200', recipient: `0x${'e'.repeat(64)}`, globalPaused: false, v1Paused: false, v2Paused: false, admin: `0x${'f'.repeat(64)}`, v1StorageReimbursement: '800000', v2StorageReimbursement: '926400' };
const nft: NormalizedNFT = { standard: 'v2', identity: { standard: 'v2', address: token }, tokenId: token, collectionId: collection, owner: seller, amount: '1', name: 'Verified NFT', description: '', metadataUri: '', image: null, collectionName: 'Verified collection', collectionCreator: seller, collectionMetadataUri: '', lastTransactionVersion: '1', maximum: null, properties: null, royalty: null, isSoulbound: false };
const listing: MarketplaceListing = { id: '9', seller, standard: 'v2', identity: nft.identity, collectionId: collection, price: '1000000000', feeBps: '200', storageReimbursement: '926400', royaltyPayee: seller, royaltyNumerator: '750', royaltyDenominator: '10000', status: 'ACTIVE', escrowAddress: `0x${'9'.repeat(64)}` };
const key = `${'veytos:market:testnet'}:${moduleAddress}:${token}:`;

function mount(asset = nft, active: MarketplaceListing | null = null, initialConfig = config, chainState?: { listing: MarketplaceListing | null; owner: string | null; ledgerVersion: string }) {
  mocks.assetState.mockResolvedValue(chainState || { listing: active, owner: active?.escrowAddress || asset.owner, ledgerVersion: '2' });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}><MarketplacePanel nft={asset} initialListing={active} initialConfig={initialConfig} /></QueryClientProvider>);
  return { ...view, client, rerenderPanel: () => view.rerender(<QueryClientProvider client={client}><MarketplacePanel nft={asset} initialListing={active} initialConfig={initialConfig} /></QueryClientProvider>) };
}

beforeEach(() => {
  onlineManager.setOnline(true);
  vi.clearAllMocks(); localStorage.clear(); mocks.wallet.connected = true; mocks.wallet.account.address.toString = () => seller; mocks.wallet.network.chainId = 2;
  mocks.config.mockResolvedValue(config); mocks.eligibility.mockResolvedValue({ eligible: true, reasons: [], royalty: { payee: seller, numerator: '750', denominator: '10000' } });
  mocks.assetState.mockResolvedValue({ listing: null, owner: seller, ledgerVersion: '2' });
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
  first.unmount(); mount(nft, listing, paused); await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel listing' }).hasAttribute('disabled')).toBe(false));
});

test('wrong network prevents all trading review actions', async () => {
  mocks.wallet.network.chainId = 1; mount(); expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Switch your wallet to Aptos testnet')); expect(screen.queryByRole('button', { name: 'Review listing' })).toBe(null);
});

test('buyer review exposes expected total before gas', async () => {
  mocks.wallet.account.address.toString = () => buyer; mount(nft, listing); await waitFor(() => expect(screen.getByRole('button', { name: 'Buy now' }).hasAttribute('disabled')).toBe(false)); fireEvent.click(screen.getByRole('button', { name: 'Buy now' })); const dialog = screen.getByRole('dialog'); expect(dialog.textContent).toContain('10.009264'); expect(dialog.textContent).toContain('Storage reimbursement');
});

test('inconsistent first BUY precheck fails without a hash, preserves diagnostics, and retries only after reconciliation', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.wallet.account.address.toString = () => buyer;
  mount(nft, listing);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy now' }).hasAttribute('disabled')).toBe(false));
  mocks.assetState.mockReset().mockResolvedValueOnce({ listing: null, owner: seller, ledgerVersion: '10' });
  fireEvent.click(screen.getByRole('button', { name: 'Buy now' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
  expect(await screen.findByText(/listing changed or is no longer available/i)).toBeTruthy();
  expect(screen.queryByText(/Check your connection/i)).toBe(null);
  expect(mocks.wallet.signAndSubmitTransaction).not.toHaveBeenCalled();
  const diagnostic = JSON.parse(localStorage.getItem(`${key}:last-error`)!);
  expect(diagnostic).toMatchObject({ stage: 'asset-state', message: 'ELISTING_STALE', hash: null });

  mocks.assetState.mockResolvedValue({ listing, owner: listing.escrowAddress, ledgerVersion: '11' });
  mocks.wallet.signAndSubmitTransaction.mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'Buy now' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
  await screen.findByText(/Review this transaction/);
  expect(mocks.wallet.signAndSubmitTransaction).toHaveBeenCalledTimes(1);
  consoleError.mockRestore();
});

test('background listing refresh is silent and keeps the last valid ACTIVE state visible', async () => {
  mocks.wallet.account.address.toString = () => buyer;
  let release!: (value: { listing: MarketplaceListing; owner: string; ledgerVersion: string }) => void;
  const delayed = new Promise<{ listing: MarketplaceListing; owner: string; ledgerVersion: string }>((resolve) => { release = resolve; });
  const view = mount(nft, listing);
  mocks.assetState.mockReset().mockReturnValue(delayed);
  void view.client.invalidateQueries({ queryKey: ['market-asset'] });
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: 'Buy now' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByText('ACTIVE')).toBeTruthy();
  expect(screen.queryByText('Updating marketplace state…')).toBe(null);
  release({ listing, owner: listing.escrowAddress!, ledgerVersion: '10' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy now' }).hasAttribute('disabled')).toBe(false));
});

test('a failed background RPC refresh cannot replace or lock a valid ACTIVE snapshot', async () => {
  mocks.wallet.account.address.toString = () => buyer;
  const view = mount(nft, listing);
  mocks.assetState.mockReset().mockRejectedValue(new Error('429 Too Many Requests'));
  await view.client.invalidateQueries({ queryKey: ['market-asset'] });
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  expect(screen.getByText('ACTIVE')).toBeTruthy();
  expect(screen.getByText('VEYTOS Escrow')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Buy now' }).hasAttribute('disabled')).toBe(false);
  expect(screen.queryByText(/Updating marketplace state/)).toBe(null);
});

test('idle UNLISTED state stays visible while its initial authoritative refresh runs silently', async () => {
  let release!: (value: { listing: null; owner: string; ledgerVersion: string }) => void;
  mocks.assetState.mockReset().mockReturnValue(new Promise((resolve) => { release = resolve; }));
  mount();
  expect(screen.getByText('UNLISTED')).toBeTruthy();
  expect(screen.getByText('List this NFT')).toBeTruthy();
  expect(screen.queryByText(/Updating marketplace state/)).toBe(null);
  release({ listing: null, owner: seller, ledgerVersion: '2' });
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  expect(screen.queryByText(/Updating marketplace state/)).toBe(null);
});

test('a committed LIST shows an action-specific transition while authoritative reconciliation is pending', async () => {
  const hash = `0x${'5'.repeat(64)}`;
  mocks.wallet.signAndSubmitTransaction.mockResolvedValue({ hash });
  mocks.reconcile.mockReturnValue(new Promise(() => {}));
  mount();
  fireEvent.change(screen.getByLabelText('Price in APT'), { target: { value: '1' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Review listing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
  expect(await screen.findByText('Updating listing…')).toBeTruthy();
  expect(screen.queryByText('Updating marketplace state…')).toBe(null);
  expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(true);
});

test('buyer can relist a purchased V2 object despite stale Indexer owner and quantity', async () => {
  mocks.wallet.account.address.toString = () => buyer;
  const stale = { ...nft, amount: '0' };
  mount(stale, null, config, { listing: null, owner: buyer, ledgerVersion: '50' });
  fireEvent.change(await screen.findByLabelText('Price in APT'), { target: { value: '1' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(false));
  expect(screen.queryByText(/does not own exactly one NFT/i)).toBe(null);
  expect(mocks.eligibility).toHaveBeenCalledWith(stale, buyer);
});

test('direct ACTIVE listing overrides stale seller discovery ownership', async () => {
  mount(nft, null, config, { listing, owner: listing.escrowAddress, ledgerVersion: '10' });
  expect(await screen.findByText('ACTIVE')).toBeTruthy();
  expect(screen.getByText(/You ·/)).toBeTruthy();
  expect(screen.getByText('VEYTOS Escrow')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cancel listing' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Review listing' })).toBe(null);
  expect(screen.queryByText(/does not own this Digital Asset/i)).toBe(null);
});

test('ACTIVE listing suppresses stale new-list eligibility diagnostics for its seller', async () => {
  mocks.eligibility.mockResolvedValue({ eligible: false, reasons: ['Connected wallet does not own this Digital Asset.'], royalty: null });
  const view = mount();
  expect(await screen.findByText('Connected wallet does not own this Digital Asset.')).toBeTruthy();
  mocks.assetState.mockResolvedValue({ listing, owner: listing.escrowAddress, ledgerVersion: '10' });
  await view.client.invalidateQueries({ queryKey: ['market-asset'] });
  await waitFor(() => expect(screen.getByText('ACTIVE')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Cancel listing' })).toBeTruthy();
  expect(screen.queryByText('Connected wallet does not own this Digital Asset.')).toBe(null);
});

test('ACTIVE listing shows seller and escrow custody to a buyer without owner eligibility warnings', () => {
  mocks.wallet.account.address.toString = () => buyer;
  mount(nft, listing);
  expect(screen.getByText('ACTIVE')).toBeTruthy();
  expect(screen.getByText(`${seller.slice(0, 6)}…${seller.slice(-4)}`)).toBeTruthy();
  expect(screen.getByText('VEYTOS Escrow')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Buy now' })).toBeTruthy();
  expect(screen.queryByText(/Only the current owner/i)).toBe(null);
});

test('unlisted non-owner sees a normal ownership explanation and no seller action', async () => {
  mocks.wallet.account.address.toString = () => buyer;
  mount(nft, null, config, { listing: null, owner: seller, ledgerVersion: '10' });
  expect(await screen.findByText('Only the current owner can list this NFT.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Review listing' })).toBe(null);
  expect(screen.queryByRole('button', { name: 'Cancel listing' })).toBe(null);
  expect(screen.queryByRole('button', { name: 'Buy now' })).toBe(null);
});

test('wallet switch from seller to buyer recomputes the active listing action', async () => {
  const view = mount(nft, listing);
  expect(screen.getByRole('button', { name: 'Cancel listing' })).toBeTruthy();
  mocks.wallet.account.address.toString = () => buyer;
  view.rerenderPanel();
  expect(await screen.findByRole('button', { name: 'Buy now' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel listing' })).toBe(null);
});

test('a non-seller wallet never receives the cancel action', () => {
  mocks.wallet.account.address.toString = () => buyer;
  mount(nft, listing);
  expect(screen.getByRole('button', { name: 'Buy now' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel listing' })).toBe(null);
});

test('network switch clears trading permissions and refetches authoritative asset state', async () => {
  const view = mount(nft, listing);
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  const before = mocks.assetState.mock.calls.length;
  mocks.wallet.network.chainId = 1;
  view.rerenderPanel();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Switch your wallet'));
  await waitFor(() => expect(mocks.assetState.mock.calls.length).toBeGreaterThan(before));
});

test('browser reconnect refetches authoritative marketplace state', async () => {
  mount(nft, listing);
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  const before = mocks.assetState.mock.calls.length;
  onlineManager.setOnline(false); onlineManager.setOnline(true);
  await waitFor(() => expect(mocks.assetState.mock.calls.length).toBeGreaterThan(before));
});

test('newer confirmed ownership cannot be overwritten by stale indexed owner data', async () => {
  const confirmedKey = `veytos:confirmed:testnet:${moduleAddress}:${token}:`;
  localStorage.setItem(confirmedKey, JSON.stringify({ version: '99', owner: buyer, action: 'buy' }));
  mocks.wallet.account.address.toString = () => buyer;
  mount(nft, null, config, { listing: null, owner: seller, ledgerVersion: '10' });
  await waitFor(() => expect(screen.getByText(`${buyer.slice(0, 6)}…${buyer.slice(-4)}`)).toBeTruthy());
  expect(screen.queryByText(`${seller.slice(0, 6)}…${seller.slice(-4)}`)).toBe(null);
});

test('duplicate LIST remains disabled while wallet submission is unresolved', async () => {
  mocks.wallet.signAndSubmitTransaction.mockReturnValue(new Promise(() => {}));
  mount();
  fireEvent.change(screen.getByLabelText('Price in APT'), { target: { value: '1' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Review listing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
  await screen.findByText(/Review this transaction/);
  expect(screen.getByRole('button', { name: 'Review listing' }).hasAttribute('disabled')).toBe(true);
  expect(mocks.wallet.signAndSubmitTransaction).toHaveBeenCalledTimes(1);
});

test('CANCEL reconciliation immediately restores owner and removes the seller action', async () => {
  const hash = `0x${'3'.repeat(64)}`;
  mount(nft, listing);
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  mocks.assetState.mockReset().mockResolvedValueOnce({ listing, owner: listing.escrowAddress, ledgerVersion: '10' })
    .mockResolvedValue({ listing: null, owner: seller, ledgerVersion: '20' });
  mocks.wallet.signAndSubmitTransaction.mockResolvedValue({ hash });
  mocks.reconcile.mockResolvedValue({ status: 'success', listing: { ...listing, status: 'CANCELLED' }, receipt: { version: '20' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel listing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel listing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
  expect(await screen.findByText(/Listing cancelled/)).toBeTruthy();
  expect(screen.getByText('UNLISTED')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel listing' })).toBe(null);
});

test('BUY reconciliation immediately shows SOLD and buyer ownership and clears Buy now', async () => {
  const hash = `0x${'4'.repeat(64)}`;
  mocks.wallet.account.address.toString = () => buyer;
  mount(nft, listing);
  await waitFor(() => expect(mocks.assetState).toHaveBeenCalled());
  mocks.assetState.mockReset().mockResolvedValueOnce({ listing, owner: listing.escrowAddress, ledgerVersion: '10' })
    .mockResolvedValue({ listing: null, owner: buyer, ledgerVersion: '30' });
  mocks.wallet.signAndSubmitTransaction.mockResolvedValue({ hash });
  mocks.reconcile.mockResolvedValue({ status: 'success', listing: { ...listing, status: 'SOLD' }, receipt: { version: '30' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy now' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Buy now' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
  expect(await screen.findByText(/Purchase verified/)).toBeTruthy();
  expect(screen.getByText('SOLD')).toBeTruthy();
  expect(screen.getByText(`${buyer.slice(0, 6)}…${buyer.slice(-4)}`)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Buy now' })).toBe(null);
});

test('interrupted no-hash request never retries automatically', async () => {
  const pending: PendingMarketplaceTransaction = { action: 'buy', hash: '', sender: buyer, listingId: '9', identity: nft.identity, expectedPrice: listing.price, expectedStorageReimbursement: listing.storageReimbursement, network: 'testnet', module: moduleAddress };
  localStorage.setItem(key, JSON.stringify(pending)); mocks.wallet.account.address.toString = () => buyer; mount(nft, listing);
  expect(await screen.findByText(/wallet request was interrupted/)).toBeTruthy(); expect(mocks.wallet.signAndSubmitTransaction).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Clear unsubmitted request' }).hasAttribute('disabled')).toBe(true);
});

test('known pending hash reconciles without submitting another transaction', async () => {
  const hash = `0x${'1'.repeat(64)}`; const pending: PendingMarketplaceTransaction = { action: 'buy', hash, sender: buyer, listingId: '9', identity: nft.identity, expectedPrice: listing.price, expectedStorageReimbursement: listing.storageReimbursement, network: 'testnet', module: moduleAddress };
  localStorage.setItem(key, JSON.stringify(pending)); mocks.wallet.account.address.toString = () => buyer; mocks.reconcile.mockResolvedValue({ status: 'success', listing: { ...listing, status: 'SOLD' }, receipt: { version: '99' } }); mount(nft, listing);
  fireEvent.click(await screen.findByRole('button', { name: 'Check transaction status' })); await screen.findByText(/Purchase verified/); expect(mocks.wallet.signAndSubmitTransaction).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBe(null);
});

test('failed reconciliation is terminal and clears the pending record', async () => {
  const hash = `0x${'2'.repeat(64)}`; const pending: PendingMarketplaceTransaction = { action: 'cancel', hash, sender: seller, listingId: '9', identity: nft.identity, network: 'testnet', module: moduleAddress };
  localStorage.setItem(key, JSON.stringify(pending)); mocks.reconcile.mockResolvedValue({ status: 'failed', message: 'EPRICE_CHANGED' }); mount(nft, listing);
  fireEvent.click(await screen.findByRole('button', { name: 'Check transaction status' })); await screen.findByText(/did not match your reviewed price/); expect(localStorage.getItem(key)).toBe(null);
});
