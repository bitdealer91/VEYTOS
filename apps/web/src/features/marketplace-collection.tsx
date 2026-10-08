'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { ChevronLeft, ChevronRight, ExternalLink, Grid2X2, Grid3X3, Search, SlidersHorizontal } from 'lucide-react';
import { parseApt } from '../../../../packages/domain/src/money';
import type { MarketplaceEvent, MarketplaceInventoryItem } from '@/lib/marketplace-data';
import { explorer, marketplaceAddress, network } from '@/lib/config';
import {
  MARKETPLACE_SESSION_EVENT, readMarketplaceSession, readMarketplaceTerminals,
  type MarketplaceSessionListing, type MarketplaceSessionTerminal,
} from '@/lib/marketplace-session';
import { Artwork } from '@/components/artwork';
import { PriceDisplay } from '@/components/ui';

type Status = 'all' | 'listed' | 'owned';
type Sort = 'price-asc' | 'price-desc' | 'recent';

function shorten(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function price(value: string) { try { return parseApt(value); } catch { return null; } }
function eventLabel(type: MarketplaceEvent['event_type']) { return type === 'PURCHASED' ? 'Bought' : type === 'CANCELLED' ? 'Cancelled' : 'Listed'; }
function relativeTime(value: string | null) {
  if (!value) return 'Indexed event';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).valueOf()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function useMarketplaceSessionProjection(collectionKey: string) {
  const [projection, setProjection] = useState<{ listings: MarketplaceSessionListing[]; terminals: MarketplaceSessionTerminal[] }>({ listings: [], terminals: [] });
  useEffect(() => {
    const moduleAddress = marketplaceAddress;
    if (!moduleAddress) return;
    const refresh = () => setProjection({
      listings: readMarketplaceSession(network, moduleAddress).filter((item) => item.collectionKey === collectionKey),
      terminals: readMarketplaceTerminals(network, moduleAddress).filter((item) => item.collectionKey === collectionKey),
    });
    refresh(); window.addEventListener(MARKETPLACE_SESSION_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(MARKETPLACE_SESSION_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [collectionKey]);
  return projection;
}

function projectedItems(items: MarketplaceInventoryItem[], listings: MarketplaceSessionListing[], terminals: MarketplaceSessionTerminal[]) {
  const merged = new Map(items.map((item) => [item.assetKey, item]));
  for (const listing of listings) {
    const current = merged.get(listing.assetKey);
    if (current?.listedVersion && BigInt(current.listedVersion) > BigInt(listing.listedVersion)) continue;
    merged.set(listing.assetKey, {
      assetKey: listing.assetKey, standard: listing.nft.standard, name: current?.name || listing.nft.name,
      metadataUri: current?.metadataUri || listing.nft.metadataUri, owner: current?.owner || null,
      listingId: listing.listingId, seller: listing.seller, price: listing.price, listedVersion: listing.listedVersion,
    });
  }
  for (const terminal of terminals) {
    const current = merged.get(terminal.assetKey);
    if (!current || (current.listedVersion && BigInt(current.listedVersion) > BigInt(terminal.transactionVersion))) continue;
    merged.set(terminal.assetKey, { ...current, owner: terminal.owner, listingId: null, seller: null, price: null, listedVersion: null });
  }
  return [...merged.values()];
}

export function MarketplaceCollectionStats({ collectionKey, items, floorPrice, activeListings, supply, totalVolume }: {
  collectionKey: string; items: MarketplaceInventoryItem[]; floorPrice: string | null; activeListings: string; supply: string | null; totalVolume: string;
}) {
  const projection = useMarketplaceSessionProjection(collectionKey);
  const effective = useMemo(() => projectedItems(items, projection.listings, projection.terminals), [items, projection]);
  const baseListed = new Set(items.filter((item) => item.listingId).map((item) => item.assetKey));
  const effectiveListed = effective.filter((item) => item.listingId);
  const effectiveKeys = new Set(effectiveListed.map((item) => item.assetKey));
  const additions = effectiveListed.filter((item) => !baseListed.has(item.assetKey)).length;
  const removals = [...baseListed].filter((assetKey) => !effectiveKeys.has(assetKey)).length;
  const correctedCount = BigInt(activeListings) + BigInt(additions) - BigInt(removals);
  const listed = correctedCount > 0n ? correctedCount : 0n;
  const completeListingWindow = BigInt(activeListings) === BigInt(baseListed.size);
  const effectiveFloor = listed === 0n ? null : completeListingWindow
    ? effectiveListed.reduce<string | null>((lowest, item) => !item.price || (lowest && BigInt(lowest) <= BigInt(item.price)) ? lowest : item.price, null)
    : floorPrice;
  return <dl className="market-hero-stats">
    <div><dt>Floor price</dt><dd>{effectiveFloor ? <PriceDisplay octas={effectiveFloor} /> : '—'}</dd></div>
    <div><dt>Listed</dt><dd>{listed.toString()}</dd></div>
    {supply !== null && <div><dt>Total supply</dt><dd>{supply}</dd></div>}
    <div><dt>Total volume</dt><dd><PriceDisplay octas={totalVolume} /></dd></div>
  </dl>;
}

function Filters({ prefix, status, setStatus, min, setMin, max, setMax, items, account }: {
  prefix: string; status: Status; setStatus: (value: Status) => void; min: string; setMin: (value: string) => void;
  max: string; setMax: (value: string) => void; items: MarketplaceInventoryItem[]; account?: string;
}) {
  const listed = items.filter((item) => item.listingId).length;
  const owned = account ? items.filter((item) => (item.seller || item.owner)?.toLowerCase() === account.toLowerCase()).length : 0;
  return <div className="market-filter-groups">
    <fieldset><legend>Status</legend>{([
      ['all', 'All', items.length], ['listed', 'Listed', listed], ['owned', 'Owned by you', owned],
    ] as const).map(([value, label, count]) => <label key={value} htmlFor={`${prefix}-${value}`}>
      <input id={`${prefix}-${value}`} type="radio" name={`${prefix}-status`} checked={status === value} onChange={() => setStatus(value)} />
      <span>{label}</span><small>{count}</small>
    </label>)}</fieldset>
    <fieldset><legend>Price</legend><div className="market-price-range">
      <label htmlFor={`${prefix}-min`}>Min APT<input id={`${prefix}-min`} inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} placeholder="0" /></label>
      <span>–</span>
      <label htmlFor={`${prefix}-max`}>Max APT<input id={`${prefix}-max`} inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} placeholder="Any" /></label>
    </div></fieldset>
    <fieldset><legend>Token standard</legend><p className="market-standard-note">{items.some((item) => item.standard === 'v1') ? 'Token V1 · Legacy' : 'Digital Asset · V2'}</p></fieldset>
  </div>;
}

function ActivityList({ events, names }: { events: MarketplaceEvent[]; names: Map<string, string> }) {
  if (!events.length) return <div className="market-activity-empty"><strong>No marketplace activity yet</strong><p>Listings, purchases, and cancellations will appear here after they are indexed.</p></div>;
  return <div className="market-activity-list">{events.map((event) => {
    const actor = event.event_type === 'PURCHASED' ? event.buyer_address || event.seller_address : event.seller_address;
    return <article key={`${event.transaction_version}:${event.event_index}`}>
      <div className={`market-event-mark ${event.event_type.toLowerCase()}`} aria-hidden="true" />
      <div className="market-event-copy"><strong>{eventLabel(event.event_type)} <Link href={`/nft/${event.asset_key}`}>{names.get(event.asset_key) || `NFT #${event.listing_id}`}</Link></strong>
        <span>{shorten(actor)}</span></div>
      <div className="market-event-value">{event.gross_price_octas ? <PriceDisplay octas={event.gross_price_octas} /> : <span>—</span>}
        <time suppressHydrationWarning dateTime={event.chain_timestamp || undefined}>{relativeTime(event.chain_timestamp)}</time></div>
      <a href={explorer('txn', event.transaction_hash)} target="_blank" rel="noreferrer" aria-label="View transaction"><ExternalLink size={13} /></a>
    </article>;
  })}</div>;
}

export function MarketplaceCollectionTrading({ collectionKey, items, events, inventoryFailed, inventoryLimited = false, activityFailed }: {
  collectionKey: string; items: MarketplaceInventoryItem[]; events: MarketplaceEvent[]; inventoryFailed: boolean; inventoryLimited?: boolean; activityFailed: boolean;
}) {
  const wallet = useWallet();
  const account = wallet.account?.address.toString();
  const [status, setStatus] = useState<Status>(items.some((item) => item.listingId) ? 'listed' : 'all');
  const [query, setQuery] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState<Sort>('price-asc');
  const [compact, setCompact] = useState(true);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const projection = useMarketplaceSessionProjection(collectionKey);
  useEffect(() => { try { setActivityCollapsed(sessionStorage.getItem('veytos:market:activity-collapsed') === 'true'); } catch {} }, []);
  const effectiveItems = useMemo(() => projectedItems(items, projection.listings, projection.terminals), [items, projection]);
  function toggleActivity() {
    setActivityCollapsed((current) => { const next = !current; try { sessionStorage.setItem('veytos:market:activity-collapsed', String(next)); } catch {} return next; });
  }
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const minimum = price(min);
    const maximum = price(max);
    return effectiveItems.filter((item) => {
      const mine = !!account && (item.seller || item.owner)?.toLowerCase() === account.toLowerCase();
      if (status === 'listed' && !item.listingId) return false;
      if (status === 'owned' && !mine) return false;
      if (needle && !item.name.toLowerCase().includes(needle) && !item.assetKey.toLowerCase().includes(needle)) return false;
      if (minimum !== null && (!item.price || BigInt(item.price) < minimum)) return false;
      if (maximum !== null && (!item.price || BigInt(item.price) > maximum)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'recent') return BigInt(a.listedVersion || 0) > BigInt(b.listedVersion || 0) ? -1 : 1;
      if (!a.price) return 1;
      if (!b.price) return -1;
      const result = BigInt(a.price) === BigInt(b.price) ? 0 : BigInt(a.price) > BigInt(b.price) ? 1 : -1;
      return sort === 'price-desc' ? -result : result;
    });
  }, [account, effectiveItems, max, min, query, sort, status]);
  const names = useMemo(() => new Map(effectiveItems.map((item) => [item.assetKey, item.name])), [effectiveItems]);
  return <section className={`market-trading-shell ${activityCollapsed ? 'activity-collapsed' : ''}`}>
    <aside className="market-filter-panel"><div className="market-panel-title"><SlidersHorizontal size={14} />Filters</div><Filters prefix="desktop" {...{ status, setStatus, min, setMin, max, setMax, items: effectiveItems, account }} /></aside>
    <div className="market-items-panel">
      <div className="market-items-heading"><div><span className="eyebrow">TRADING INVENTORY</span><h2>Items</h2></div><span>{visible.length} shown</span></div>
      <details className="market-mobile-filters"><summary><SlidersHorizontal size={15} />Filters</summary><Filters prefix="mobile" {...{ status, setStatus, min, setMin, max, setMax, items: effectiveItems, account }} /></details>
      <div className="market-items-toolbar"><label className="market-item-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or token ID" aria-label="Search collection items" /></label>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort items"><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="recent">Recently listed</option></select>
        <div className="market-density" aria-label="Grid density"><button aria-pressed={!compact} onClick={() => setCompact(false)} aria-label="Comfortable grid"><Grid2X2 size={15} /></button><button aria-pressed={compact} onClick={() => setCompact(true)} aria-label="Compact grid"><Grid3X3 size={15} /></button></div>
      </div>
      {inventoryFailed && <p className="market-local-notice">Collection metadata is temporarily unavailable. Active listings remain visible from the VEYTOS projection.</p>}
      {!inventoryFailed && inventoryLimited && <p className="market-local-notice">Showing the first 100 currently indexed items. Active listings outside this window remain included.</p>}
      {visible.length ? <div className={`market-nft-grid ${compact ? 'compact' : ''}`}>{visible.map((item) => {
        const mine = !!account && (item.seller || item.owner)?.toLowerCase() === account.toLowerCase();
        return <article className="market-nft-card" key={item.assetKey}><Link href={`/nft/${item.assetKey}`} className="market-nft-art"><Artwork uri={item.metadataUri} name={item.name} /><span>{item.standard === 'v1' ? 'V1' : 'V2'}</span></Link>
          <div className="market-nft-copy"><h3><Link href={`/nft/${item.assetKey}`}>{item.name}</Link></h3>
            <div>{item.price ? <PriceDisplay octas={item.price} /> : <span className="market-unlisted">Not listed</span>}<Link className={item.listingId ? 'market-buy-link' : 'market-view-link'} href={`/nft/${item.assetKey}`}>{item.listingId ? mine ? 'Manage' : 'Buy' : mine ? 'List' : 'View'}</Link></div>
          </div></article>;
      })}</div> : <div className="market-inventory-empty"><strong>{effectiveItems.length ? 'No items match these filters' : 'No collection items available'}</strong><p>{effectiveItems.length ? 'Clear the price or status filters to view the available collection inventory.' : 'Indexed NFTs will appear here when collection inventory becomes available.'}</p></div>}
      <details className="market-mobile-activity"><summary>Activity <span>{events.length}</span></summary>{activityFailed && <p className="market-local-notice">Activity is temporarily unavailable.</p>}<ActivityList events={events} names={names} /></details>
    </div>
    <div className="market-activity-divider"><button onClick={toggleActivity} aria-label={activityCollapsed ? 'Expand activity panel' : 'Collapse activity panel'}>{activityCollapsed ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button></div>
    {!activityCollapsed && <aside className="market-activity-panel"><div className="market-items-heading"><div><span className="eyebrow">MARKET EVENTS</span><h2>Activity</h2></div></div>{activityFailed ? <p className="market-local-notice">Activity is temporarily unavailable.</p> : <ActivityList events={events} names={names} />}</aside>}
  </section>;
}
