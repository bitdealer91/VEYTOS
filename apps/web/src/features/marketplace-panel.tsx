'use client';
import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, X } from 'lucide-react';
import type { NormalizedNFT } from '@veytos/aptos/discovery';
import { encodeNFTIdentity, marketplaceErrorDiagnostic, marketplaceErrorMessage, quoteMarketplaceSale, marketplacePaused, type MarketplacePreparationStage } from '@veytos/aptos/marketplace';
import type { MarketplaceAssetState, MarketplaceConfig, MarketplaceEconomics, MarketplaceListing, PendingMarketplaceTransaction, TransactionPhase } from '@veytos/aptos/types';
import { definitiveRejection, transactionTransition } from '@veytos/aptos/recovery';
import { isUnresolved, networkMatches, readableError } from '@veytos/aptos/domain';
import { parseApt } from '../../../../packages/domain/src/money';
import { marketChain } from '@/lib/chain';
import { explorer, marketplaceAddress, network } from '@/lib/config';
import { PriceDisplay, ExternalLink } from '@/components/ui';
import { WalletButton } from '@/components/wallet';
import { TransactionStatus } from './mint-panel';
import { WalletAddress } from '@/components/chain-ui';

type Action = 'list' | 'cancel' | 'buy';
type ExplicitTransition = Action | 'wallet' | null;
export function MarketplacePanel({ nft, initialListing, initialConfig, initialAssetState }: {
  nft: NormalizedNFT; initialListing: MarketplaceListing | null; initialConfig: MarketplaceConfig; initialAssetState?: MarketplaceAssetState;
}) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const account = wallet.account?.address.toString();
  const dialog = useRef<HTMLDialogElement>(null);
  const signing = useRef(false);
  const [priceInput, setPriceInput] = useState('');
  const [action, setAction] = useState<Action>('list');
  const [phase, setPhase] = useState<TransactionPhase>('ready');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingMarketplaceTransaction | null>(null);
  const [recoveryHash, setRecoveryHash] = useState('');
  const [checkedWallet, setCheckedWallet] = useState(false);
  const [confirmedOwner, setConfirmedOwner] = useState<string | null>(null);
  const [confirmedVersion, setConfirmedVersion] = useState<string | undefined>();
  const confirmedVersionRef = useRef<string | undefined>(undefined);
  const [transition, setTransition] = useState<ExplicitTransition>(null);
  const [terminalStatus, setTerminalStatus] = useState<'SOLD' | null>(null);
  const walletScope = useRef<string | null>(null);
  const currentWalletScope = `${account || 'disconnected'}:${wallet.network?.chainId ?? 'unknown'}`;
  const walletScopeChanging = walletScope.current !== null && walletScope.current !== currentWalletScope;
  const assetRoute = `${nft.tokenId}:${nft.identity.standard === 'v1' ? nft.identity.propertyVersion : ''}`;
  const confirmedKey = `veytos:confirmed:${network}:${marketplaceAddress}:${assetRoute}`;
  const assetQuery = useQuery({
    queryKey: ['market-asset', network, marketplaceAddress, assetRoute],
    queryFn: () => marketChain().assetState(nft.identity, nft.collectionId, confirmedVersionRef.current, { retries: 0 }),
    initialData: initialAssetState || { listing: initialListing, owner: nft.standard === 'v2' ? initialListing?.escrowAddress || nft.owner : null, ledgerVersion: nft.lastTransactionVersion },
    initialDataUpdatedAt: Date.now(),
    staleTime: 30000, refetchOnWindowFocus: false, refetchOnReconnect: 'always',
  });
  const listing = assetQuery.data.listing;
  const snapshotIsNewer = !!confirmedVersion && BigInt(confirmedVersion) > BigInt(assetQuery.data.ledgerVersion);
  const currentOwner = listing ? assetQuery.data.owner : snapshotIsNewer ? confirmedOwner : assetQuery.data.owner || confirmedOwner || nft.owner;
  const owner = !listing && !!currentOwner && currentOwner.toLowerCase() === account?.toLowerCase();
  const seller = !!listing && listing.seller.toLowerCase() === account?.toLowerCase();
  const active = listing?.status === 'ACTIVE';
  const selected: Action = active ? seller ? 'cancel' : 'buy' : 'list';
  const key = `veytos:market:${network}:${marketplaceAddress}:${assetRoute}`;
  const legacyKey = `veytos:market:${network}:${marketplaceAddress}:asset:${assetRoute}`;
  const configQuery = useQuery({
    queryKey: ['market-config', network, marketplaceAddress], queryFn: () => marketChain().config({ retries: 0 }),
    initialData: initialConfig, initialDataUpdatedAt: Date.now(), staleTime: 5 * 60_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const explicitTransition = transition !== null || walletScopeChanging;
  // TanStack staleness and background RPC failures do not invalidate the last
  // authoritative snapshot. submit() always performs a fresh chain precheck
  // before asking the wallet to sign.
  const authoritativeStateUnavailable = !assetQuery.data?.ledgerVersion;
  const eligibility = useQuery({
    queryKey: ['market-eligibility', network, nft.tokenId, account],
    queryFn: () => marketChain().eligibility(nft, account!, currentOwner, { retries: 0 }), enabled: !!account && owner && !active && !explicitTransition && !authoritativeStateUnavailable,
  });
  const config = configQuery.data;
  const locked = isUnresolved(phase) || explicitTransition || authoritativeStateUnavailable;
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

  function invalidateProjections() {
    const roots = ['market-eligibility', 'wallet-nfts', 'nft-detail', 'collection-market', 'market-activity'];
    for (const root of roots) void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === root, refetchType: 'none' });
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(confirmedKey);
      if (!raw) return;
      const value = JSON.parse(raw) as { version?: string; owner?: string; action?: Action; listingStatus?: 'SOLD' };
      if (value.version && /^\d+$/.test(value.version) && BigInt(value.version) > BigInt(nft.lastTransactionVersion) && value.owner) {
        confirmedVersionRef.current = value.version; setConfirmedVersion(value.version); setConfirmedOwner(value.owner);
        if (value.listingStatus === 'SOLD' || value.action === 'buy') setTerminalStatus('SOLD');
      }
      else localStorage.removeItem(confirmedKey);
    } catch { /* A corrupt display snapshot never authorizes an action. */ }
  }, [confirmedKey, nft.lastTransactionVersion]);

  useEffect(() => {
    const next = currentWalletScope;
    if (walletScope.current === null) { walletScope.current = next; return; }
    if (walletScope.current === next) return;
    walletScope.current = next;
    if (!isUnresolved(phase)) { setMessage(''); setPhase('ready'); }
    setTransition('wallet');
    void queryClient.invalidateQueries({ predicate: (query) => ['market-eligibility', 'wallet-nfts'].includes(String(query.queryKey[0])), refetchType: 'none' })
      .finally(() => setTransition(null));
  }, [account, wallet.network?.chainId, currentWalletScope, phase, queryClient]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible' || transition !== null) return;
      const state = queryClient.getQueryState(['market-asset', network, marketplaceAddress, assetRoute]);
      if (!state || Date.now() - state.dataUpdatedAt < 30_000) return;
      void queryClient.refetchQueries({ queryKey: ['market-asset', network, marketplaceAddress, assetRoute], type: 'active' });
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [assetRoute, marketplaceAddress, queryClient, transition]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key) || localStorage.getItem(legacyKey);
      if (raw) {
        const value = JSON.parse(raw) as PendingMarketplaceTransaction;
        if (value.module === marketplaceAddress && value.network === network) {
          localStorage.setItem(key, raw); localStorage.removeItem(legacyKey); setPending(value); setPhase('unknown');
          setMessage(value.hash ? 'A marketplace transaction needs confirmation before another action.' : 'A wallet request was interrupted. Check wallet activity before continuing.');
        }
      }
    } catch { setPhase('unknown'); setMessage('Transaction recovery storage is unavailable.'); }
  }, [key, legacyKey]);

  function save(value: PendingMarketplaceTransaction) {
    setPending(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { if (!value.hash) throw error; }
  }
  function clear() { try { localStorage.removeItem(key); localStorage.removeItem(legacyKey); } catch {} }
  async function reconcile(value: PendingMarketplaceTransaction) {
    if (!value.hash) return;
    setTransition(value.action);
    setPhase((current) => transactionTransition(current, 'confirm', true));
    setMessage('Verifying the listing, event, and ownership state on Aptos…');
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const result = await marketChain().reconcile(value);
        if (result.status === 'failed') { setPhase('failure'); setMessage(readableError(new Error(result.message))); clear(); setTransition(null); return; }
        if (result.status === 'success') {
          const nextOwner = value.action === 'list' ? result.listing.escrowAddress : value.action === 'cancel' ? result.listing.seller : value.sender;
          queryClient.setQueryData(['market-asset', network, marketplaceAddress, assetRoute], {
            listing: value.action === 'list' ? result.listing : null, owner: nextOwner, ledgerVersion: result.receipt.version,
          });
          if (nextOwner) {
            confirmedVersionRef.current = result.receipt.version; setConfirmedVersion(result.receipt.version); setConfirmedOwner(nextOwner);
            const listingStatus = value.action === 'buy' ? 'SOLD' : undefined;
            setTerminalStatus(listingStatus || null);
            try { localStorage.setItem(confirmedKey, JSON.stringify({ version: result.receipt.version, owner: nextOwner, action: value.action, listingStatus })); } catch {}
          }
          setPhase('success'); clear();
          setMessage(value.action === 'list' ? 'Listing is active on Aptos.' : value.action === 'cancel' ? 'Listing cancelled. Your NFT has been returned.' : 'Purchase verified. The NFT is now owned by the buyer.');
          invalidateProjections();
          setTransition(null);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      setTransition(null);
      setPhase('unknown'); setMessage('Confirmation is taking longer than expected. The hash is saved; no transaction will be retried automatically.');
    } catch { setTransition(null); setPhase('unknown'); setMessage('Chain reconciliation is temporarily unavailable. Keep this hash and check again.'); }
  }
  async function submit() {
    if (!account || signing.current || !marketplaceAddress) return;
    signing.current = true;
    dialog.current?.close();
    let value: PendingMarketplaceTransaction | null = null;
    let requested = false;
    let stage: MarketplacePreparationStage = 'configuration';
    try {
      const retrying = () => setMessage('Marketplace data is temporarily unavailable. Retrying…');
      const freshPause = await marketChain().pauseState({ onRateLimit: retrying });
      if (!networkMatches(config.chainId, wallet.network?.chainId)) throw new Error('Wrong network');
      if (action !== 'cancel' && (freshPause.globalPaused || (nft.standard === 'v1' ? freshPause.v1Paused : freshPause.v2Paused))) throw new Error('EPAUSED');
      stage = 'asset-state';
      const floor = [confirmedVersionRef.current, assetQuery.data.ledgerVersion].filter((version): version is string => !!version)
        .reduce((latest, version) => BigInt(version) > BigInt(latest) ? version : latest, '0');
      const freshAsset = await marketChain().assetState(nft.identity, nft.collectionId, floor, { onRateLimit: retrying });
      if (action === 'list') {
        if (freshAsset.listing) throw new Error('This NFT already has an active listing.');
        stage = 'eligibility';
        const check = await marketChain().eligibility(nft, account, freshAsset.owner, { onRateLimit: retrying });
        if (!check.eligible) throw new Error(check.reasons[0]);
        if (!economics) throw new Error('Invalid price');
      }
      const reviewedListing = action === 'list' ? null : freshAsset.listing;
      if ((action === 'buy' || action === 'cancel') && !reviewedListing) throw new Error('ELISTING_STALE');
      if (reviewedListing && (!listing || reviewedListing.id !== listing.id || reviewedListing.seller !== listing.seller ||
          encodeNFTIdentity(reviewedListing.identity) !== encodeNFTIdentity(listing.identity) || reviewedListing.storageReimbursement !== listing.storageReimbursement)) throw new Error('ELISTING_STALE');
      if (reviewedListing && reviewedListing.price !== listing?.price) throw new Error('EPRICE_CHANGED');
      if (reviewedListing?.standard === 'v2' && (!reviewedListing.escrowAddress || freshAsset.owner !== reviewedListing.escrowAddress)) throw new Error('ESTATE_UPDATING');
      if (action === 'cancel' && reviewedListing?.seller.toLowerCase() !== account.toLowerCase()) throw new Error('Only the seller can cancel this listing.');
      if (action === 'buy' && reviewedListing?.seller.toLowerCase() === account.toLowerCase()) throw new Error('The seller cannot buy their own listing.');
      value = {
        action, hash: '', sender: account, listingId: reviewedListing?.id, identity: nft.identity,
        expectedPrice: action === 'list' ? economics?.price.toString() : reviewedListing?.price,
        expectedStorageReimbursement: reviewedListing?.storageReimbursement,
        network, module: marketplaceAddress,
      };
      stage = 'payload';
      const data = action === 'list' ? marketChain().listPayload(nft.identity, economics!.price.toString())
        : action === 'cancel' ? marketChain().cancelPayload(nft.standard, reviewedListing!.id) : marketChain().buyPayload(reviewedListing!);
      save(value); requested = true; stage = 'wallet'; setPhase('wallet'); setMessage('Review this transaction in your Aptos wallet.');
      const response = await wallet.signAndSubmitTransaction({ data });
      if (!/^0x[0-9a-f]{64}$/i.test(response.hash)) throw new Error('Unknown submission');
      value = { ...value, hash: response.hash }; save(value); setPhase('submitted');
      await reconcile(value);
    } catch (error) {
      const diagnostic = marketplaceErrorDiagnostic(error, stage);
      console.error('[VEYTOS marketplace transaction]', diagnostic);
      try { localStorage.setItem(`${key}:last-error`, JSON.stringify({ ...diagnostic, action, at: new Date().toISOString(), hash: value?.hash || null })); } catch {}
      const rejected = definitiveRejection(error);
      if (value?.hash || (requested && !rejected)) { setPhase('unknown'); setMessage(value?.hash ? 'The transaction hash is retained for reconciliation.' : 'No hash was returned. Submission is not confirmed; check wallet activity before another action.'); }
      else { setPhase('failure'); setMessage(marketplaceErrorMessage(error, stage)); if (requested) clear(); }
    } finally { signing.current = false; }
  }
  function review(next: Action) {
    setAction(next); setMessage(''); setPhase('review'); dialog.current?.showModal();
  }

  if (!marketplaceAddress) return <aside className="market-panel"><p className="notice warning">Marketplace transactions are not configured for this network.</p></aside>;
  const displayStatus = active ? 'ACTIVE' : terminalStatus || 'UNLISTED';
  const transitionMessage = transition === 'list' ? 'Updating listing…'
    : transition === 'cancel' ? 'Returning NFT…'
    : transition === 'buy' ? 'Confirming purchase…'
    : transition === 'wallet' || walletScopeChanging ? 'Updating wallet permissions…'
    : null;
  return <aside className="market-panel">
    <span className="eyebrow">SECONDARY MARKET</span>
    <h2>{active ? <PriceDisplay octas={listing.price} /> : owner ? 'List this NFT' : terminalStatus === 'SOLD' ? 'Sold' : 'Not listed'}</h2>
    <dl className="market-state">
      <div><dt>Listing</dt><dd>{displayStatus}</dd></div>
      {active ? <>
        <div><dt>Seller</dt><dd>{seller && 'You · '}<WalletAddress address={listing.seller} /></dd></div>
        <div><dt>Custody</dt><dd>VEYTOS Escrow</dd></div>
        {listing.escrowAddress && <div><dt>On-chain owner</dt><dd><WalletAddress address={listing.escrowAddress} /></dd></div>}
      </> : <div><dt>Owner</dt><dd>{currentOwner ? <WalletAddress address={currentOwner} /> : 'Updating…'}</dd></div>}
    </dl>
    {paused && <p className="notice warning">Marketplace trading is temporarily paused. Sellers can still cancel and recover listed NFTs.</p>}
    {transitionMessage && <p className="notice" aria-live="polite">{transitionMessage}</p>}
    {!active && owner && <label className="price-input">Price in APT<input value={priceInput} inputMode="decimal" placeholder="1.00" onChange={(event) => setPriceInput(event.target.value)} /></label>}
    {active && <dl><div><dt>Storage reimbursement</dt><dd><PriceDisplay octas={listing.storageReimbursement} /></dd></div></dl>}
    {!wallet.connected ? <WalletButton label="Connect wallet" />
      : !rightNetwork ? <p className="notice warning" role="alert">Switch your wallet to Aptos {network} to trade.</p>
      : selected === 'list' && owner ? <button className="button primary" disabled={locked || paused || !economics || eligibility.isLoading || eligibility.data?.eligible === false} onClick={() => review('list')}>Review listing</button>
      : selected === 'cancel' ? <button className="button primary" disabled={locked} onClick={() => review('cancel')}>Cancel listing</button>
      : selected === 'buy' ? <button className="button primary" disabled={locked || paused} onClick={() => review('buy')}>Buy now</button>
      : null}
    {!active && owner && eligibility.data && !eligibility.data.eligible && <p className="notice error">{eligibility.data.reasons[0]}</p>}
    {!active && wallet.connected && rightNetwork && !owner && !explicitTransition && <p className="notice">Only the current owner can list this NFT.</p>}
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
      <button className="button primary" disabled={locked || !rightNetwork || (action !== 'cancel' && !economics)} onClick={submit}>Confirm in wallet</button>
    </dialog>
  </aside>;
}
