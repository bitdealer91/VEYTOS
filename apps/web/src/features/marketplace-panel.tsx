'use client';
import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, X } from 'lucide-react';
import type { NormalizedNFT } from '@veytos/aptos/discovery';
import { quoteMarketplaceSale, marketplacePaused } from '@veytos/aptos/marketplace';
import type { MarketplaceConfig, MarketplaceEconomics, MarketplaceListing, PendingMarketplaceTransaction, TransactionPhase } from '@veytos/aptos/types';
import { definitiveRejection, transactionTransition } from '@veytos/aptos/recovery';
import { networkMatches, readableError } from '@veytos/aptos/domain';
import { parseApt } from '../../../../packages/domain/src/money';
import { marketChain } from '@/lib/chain';
import { explorer, marketplaceAddress, network } from '@/lib/config';
import { PriceDisplay, ExternalLink } from '@/components/ui';
import { WalletButton } from '@/components/wallet';
import { TransactionStatus } from './mint-panel';

type Action = 'list' | 'cancel' | 'buy';
export function MarketplacePanel({ nft, initialListing, initialConfig }: {
  nft: NormalizedNFT; initialListing: MarketplaceListing | null; initialConfig: MarketplaceConfig;
}) {
  const wallet = useWallet();
  const account = wallet.account?.address.toString();
  const dialog = useRef<HTMLDialogElement>(null);
  const signing = useRef(false);
  const [listing, setListing] = useState(initialListing);
  const [priceInput, setPriceInput] = useState('');
  const [action, setAction] = useState<Action>('list');
  const [phase, setPhase] = useState<TransactionPhase>('ready');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingMarketplaceTransaction | null>(null);
  const [recoveryHash, setRecoveryHash] = useState('');
  const [checkedWallet, setCheckedWallet] = useState(false);
  const owner = nft.owner.toLowerCase() === account?.toLowerCase();
  const active = listing?.status === 'ACTIVE';
  const selected: Action = active ? owner ? 'cancel' : 'buy' : 'list';
  const key = `veytos:market:${network}:${marketplaceAddress}:${listing?.id || 'asset'}:${nft.tokenId}:${nft.identity.standard === 'v1' ? nft.identity.propertyVersion : ''}`;
  const configQuery = useQuery({ queryKey: ['market-config', network, marketplaceAddress], queryFn: () => marketChain().config(), initialData: initialConfig, refetchInterval: 15000 });
  const eligibility = useQuery({
    queryKey: ['market-eligibility', network, nft.tokenId, account],
    queryFn: () => marketChain().eligibility(nft, account!), enabled: !!account && owner && !active,
  });
  const config = configQuery.data;
  const rightNetwork = networkMatches(config.chainId, wallet.network?.chainId);
  const paused = marketplacePaused(config, nft.standard);
  const royalty = listing ? { numerator: listing.royaltyNumerator, denominator: listing.royaltyDenominator }
    : eligibility.data?.royalty;
  let economics: MarketplaceEconomics | null = null;
  try {
    const price = listing ? BigInt(listing.price) : priceInput ? parseApt(priceInput) : 0n;
    if (price > 0n && royalty) economics = quoteMarketplaceSale(
      price, BigInt(listing?.feeBps || config.feeBps), BigInt(royalty.numerator), BigInt(royalty.denominator),
      BigInt(listing?.storageReimbursement || (nft.standard === 'v1' ? config.v1StorageReimbursement : config.v2StorageReimbursement)),
    );
  } catch { economics = null; }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value = JSON.parse(raw) as PendingMarketplaceTransaction;
        if (value.module === marketplaceAddress && value.network === network) {
          setPending(value); setPhase('unknown');
          setMessage(value.hash ? 'A marketplace transaction needs confirmation before another action.' : 'A wallet request was interrupted. Check wallet activity before continuing.');
        }
      }
    } catch { setPhase('unknown'); setMessage('Transaction recovery storage is unavailable.'); }
  }, [key]);

  function save(value: PendingMarketplaceTransaction) {
    setPending(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { if (!value.hash) throw error; }
  }
  function clear() { try { localStorage.removeItem(key); } catch {} }
  async function reconcile(value: PendingMarketplaceTransaction) {
    if (!value.hash) return;
    setPhase((current) => transactionTransition(current, 'confirm', true));
    setMessage('Verifying the listing, event, and ownership state on Aptos…');
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const result = await marketChain().reconcile(value);
        if (result.status === 'failed') { setPhase('failure'); setMessage(readableError(new Error(result.message))); clear(); return; }
        if (result.status === 'success') {
          setListing(result.listing); setPhase('success'); clear();
          setMessage(value.action === 'list' ? 'Listing is active on Aptos.' : value.action === 'cancel' ? 'Listing cancelled. Your NFT has been returned.' : 'Purchase verified. The NFT is now owned by the buyer.');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      setPhase('unknown'); setMessage('Confirmation is taking longer than expected. The hash is saved; no transaction will be retried automatically.');
    } catch { setPhase('unknown'); setMessage('Chain reconciliation is temporarily unavailable. Keep this hash and check again.'); }
  }
  async function submit() {
    if (!account || signing.current || !marketplaceAddress) return;
    signing.current = true;
    dialog.current?.close();
    let value: PendingMarketplaceTransaction | null = null;
    let requested = false;
    try {
      const freshConfig = await marketChain().config();
      if (!networkMatches(freshConfig.chainId, wallet.network?.chainId)) throw new Error('Wrong network');
      if (action !== 'cancel' && marketplacePaused(freshConfig, nft.standard)) throw new Error('EPAUSED');
      if (action === 'list') {
        const check = await marketChain().eligibility(nft, account);
        if (!check.eligible) throw new Error(check.reasons[0]);
        if (!economics) throw new Error('Invalid price');
      }
      if ((action === 'buy' || action === 'cancel') && !listing) throw new Error('Listing unavailable');
      value = {
        action, hash: '', sender: account, listingId: listing?.id, identity: nft.identity,
        expectedPrice: listing?.price, expectedStorageReimbursement: listing?.storageReimbursement,
        network, module: marketplaceAddress,
      };
      save(value); requested = true; setPhase('wallet'); setMessage('Review this transaction in your Aptos wallet.');
      const data = action === 'list' ? marketChain().listPayload(nft.identity, economics!.price.toString())
        : action === 'cancel' ? marketChain().cancelPayload(nft.standard, listing!.id) : marketChain().buyPayload(listing!);
      const response = await wallet.signAndSubmitTransaction({ data });
      if (!/^0x[0-9a-f]{64}$/i.test(response.hash)) throw new Error('Unknown submission');
      value = { ...value, hash: response.hash }; save(value); setPhase('submitted');
      await reconcile(value);
    } catch (error) {
      const rejected = definitiveRejection(error);
      if (value?.hash || (requested && !rejected)) { setPhase('unknown'); setMessage(value?.hash ? 'The transaction hash is retained for reconciliation.' : 'No hash was returned. Submission is not confirmed; check wallet activity before another action.'); }
      else { setPhase('failure'); setMessage(readableError(error)); if (requested) clear(); }
    } finally { signing.current = false; }
  }
  function review(next: Action) {
    setAction(next); setMessage(''); setPhase('review'); dialog.current?.showModal();
  }

  if (!marketplaceAddress) return <aside className="market-panel"><p className="notice warning">Marketplace transactions are not configured for this network.</p></aside>;
  return <aside className="market-panel">
    <span className="eyebrow">SECONDARY MARKET</span>
    <h2>{active ? <PriceDisplay octas={listing.price} /> : owner ? 'List this NFT' : 'Not listed'}</h2>
    {paused && <p className="notice warning">Marketplace trading is temporarily paused. Sellers can still cancel and recover listed NFTs.</p>}
    {!active && owner && <label className="price-input">Price in APT<input value={priceInput} inputMode="decimal" placeholder="1.00" onChange={(event) => setPriceInput(event.target.value)} /></label>}
    {active && <dl><div><dt>Seller</dt><dd>{listing.seller.slice(0, 8)}…{listing.seller.slice(-6)}</dd></div><div><dt>Storage reimbursement</dt><dd><PriceDisplay octas={listing.storageReimbursement} /></dd></div></dl>}
    {!wallet.connected ? <WalletButton label="Connect wallet" />
      : !rightNetwork ? <p className="notice warning" role="alert">Switch your wallet to Aptos {network} to trade.</p>
      : selected === 'list' ? <button className="button primary" disabled={!owner || paused || !economics || eligibility.isLoading || eligibility.data?.eligible === false} onClick={() => review('list')}>Review listing</button>
      : selected === 'cancel' ? <button className="button primary" onClick={() => review('cancel')}>Cancel listing</button>
      : <button className="button primary" disabled={paused} onClick={() => review('buy')}>Buy now</button>}
    {eligibility.data && !eligibility.data.eligible && <p className="notice error">{eligibility.data.reasons[0]}</p>}
    {message && <TransactionStatus phase={phase} hash={pending?.hash} message={message} />}
    {phase === 'unknown' && pending?.hash && <button className="button" onClick={() => reconcile(pending)}>Check transaction status</button>}
    {phase === 'unknown' && pending && !pending.hash && <div className="recovery"><p>No submission is confirmed. If your wallet shows this marketplace transaction, paste its hash to verify it. This never signs another transaction.</p><input type="text" aria-label="Recovery transaction hash" placeholder="0x… transaction hash" value={recoveryHash} onChange={(event) => setRecoveryHash(event.target.value)} /><button className="button" disabled={!/^0x[0-9a-f]{64}$/i.test(recoveryHash)} onClick={() => { const value = { ...pending, hash: recoveryHash }; save(value); void reconcile(value); }}>Verify wallet transaction</button><label><input type="checkbox" checked={checkedWallet} onChange={(event) => setCheckedWallet(event.target.checked)} />I closed the wallet request and checked its activity: no transaction was signed or submitted.</label><button className="button" disabled={!checkedWallet || signing.current} onClick={() => { clear(); setPending(null); setPhase('ready'); setMessage('Request cleared after your confirmation. Nothing was automatically retried.'); setCheckedWallet(false); }}>Clear unsubmitted request</button></div>}
    {phase === 'success' && pending?.hash && <div className="trade-success"><Check size={24}/><ExternalLink href={explorer('txn', pending.hash)}>View transaction</ExternalLink><a className="text-link" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Collected ${nft.name} on VEYTOS.`)}&url=${encodeURIComponent(window.location.href)}`}>Share on X <ArrowUpRight size={14}/></a></div>}
    <dialog className="dialog" ref={dialog} onCancel={() => setPhase('ready')}>
      <div className="dialog-head"><span className="eyebrow">REVIEW {action.toUpperCase()}</span><button className="icon-button" aria-label="Close review" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
      <h2>{action === 'list' ? 'List NFT' : action === 'cancel' ? 'Cancel listing' : 'Buy NFT'}</h2>
      <p>{nft.name} · {nft.standard === 'v1' ? `Token V1 · property version ${nft.identity.standard === 'v1' ? nft.identity.propertyVersion : ''}` : 'Digital Asset V2'}</p>
      {economics && <div className="review-summary">
        <div><span>{action === 'buy' ? 'Purchase price' : 'Sale price'}</span><PriceDisplay octas={economics.price.toString()} /></div>
        <div><span>VEYTOS fee · {Number(listing?.feeBps || config.feeBps) / 100}%</span><PriceDisplay octas={economics.fee.toString()} /></div>
        <div><span>Creator royalty</span><PriceDisplay octas={economics.royalty.toString()} /></div>
        {action !== 'buy' && <div><span>Seller receives</span><PriceDisplay octas={economics.sellerProceeds.toString()} /></div>}
        <div><span>Storage reimbursement</span><PriceDisplay octas={economics.storageReimbursement.toString()} /></div>
        {action === 'buy' && <div><span>Total before gas</span><PriceDisplay octas={economics.buyerTotalBeforeGas.toString()} /></div>}
      </div>}
      <p className="caption muted">Aptos may return protocol storage refunds during successful settlement. The reimbursement shown above prevents that refund from changing the reviewed seller economics.</p>
      <button className="button primary" disabled={!rightNetwork || (action !== 'cancel' && !economics)} onClick={submit}>Confirm in wallet</button>
    </dialog>
  </aside>;
}
