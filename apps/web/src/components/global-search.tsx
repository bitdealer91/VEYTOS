'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, Search, X } from 'lucide-react';
import type { GlobalSearchResult, LaunchpadSearchResult, MarketplaceSearchResult } from '@/lib/marketplace-search';
import { Artwork } from './artwork';

type SearchResponse = { launchpad: LaunchpadSearchResult[]; marketplace: MarketplaceSearchResult[]; partial?: boolean };

export function GlobalSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [partial, setPartial] = useState(false);
  const [active, setActive] = useState(-1);
  const normalized = query.trim();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        const target = event.target as HTMLElement | null;
        if (target?.matches('input, textarea, select, [contenteditable="true"]') && document.activeElement !== input.current) return;
        event.preventDefault(); input.current?.focus(); setOpen(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onShortcut);
    return () => { document.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onShortcut); };
  }, []);

  useEffect(() => {
    request.current?.abort();
    if (normalized.length < 2) {
      setItems([]); setLoading(false); setFailed(false); setPartial(false); setActive(-1);
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setFailed(false);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
        const data = await response.json() as SearchResponse;
        setItems([...data.launchpad, ...data.marketplace]); setPartial(!!data.partial); setActive(-1);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') { setItems([]); setFailed(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [normalized]);

  function close() { setOpen(false); setActive(-1); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalized) return;
    if (active >= 0 && items[active]) router.push(items[active].href);
    else router.push(`/search?q=${encodeURIComponent(normalized)}`);
    close();
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { close(); input.current?.blur(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault(); setOpen(true);
    const optionCount = items.length + (normalized.length >= 2 ? 1 : 0);
    if (!optionCount) return;
    setActive((current) => event.key === 'ArrowDown' ? (current + 1) % optionCount : (current <= 0 ? optionCount - 1 : current - 1));
  }

  const showPanel = open && normalized.length >= 2;
  const launchpadItems = items.filter((item): item is LaunchpadSearchResult => item.area === 'launchpad');
  const marketplaceItems = items.filter((item): item is MarketplaceSearchResult => item.area === 'marketplace');
  let optionIndex = -1;
  const result = (item: GlobalSearchResult) => {
    const index = ++optionIndex;
    const launchpad = item.area === 'launchpad';
    return <Link key={`${item.area}:${item.href}`} id={`${listId}-${index}`} role="option" aria-selected={active === index}
      className="global-search-result" href={item.href} onMouseEnter={() => setActive(index)} onClick={close}>
      <span className="global-search-art"><Artwork uri={item.metadataUri} name={item.name} /></span>
      <span className="global-search-copy"><strong>{item.name}{!launchpad && item.verified && <BadgeCheck size={13} aria-label="Verified VEYTOS collection" />}</strong>
        <small>{launchpad ? `${item.creator.slice(0, 8)}…${item.creator.slice(-4)} · Aptos collection` : `${item.creatorName || `${item.creator.slice(0, 8)}…${item.creator.slice(-4)}`} · ${item.standard.toUpperCase()}${item.native ? ' · VEYTOS native' : ''}`}</small></span>
      <span className={`global-search-place ${item.area}`}><b>{launchpad ? 'Launchpad' : 'Marketplace'}</b>
        <small>{launchpad ? `${item.status === 'SOLD OUT' ? 'Sold out' : item.status[0] + item.status.slice(1).toLowerCase()} · ${item.minted}/${item.supply} minted` : `${item.activeListings} listed`}</small></span>
    </Link>;
  };
  return <form ref={root} action="/search" className="search global-search" role="search" onSubmit={submit}>
    <Search size={17} aria-hidden="true" />
    <input ref={input} name="q" value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={keyDown}
      role="combobox" aria-label="Search collections" aria-expanded={showPanel} aria-controls={showPanel ? listId : undefined}
      aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} aria-autocomplete="list" placeholder="Search collections or addresses" autoComplete="off" />
    {query ? <button type="button" className="global-search-clear" aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={14} /></button>
      : <kbd aria-hidden="true">/</kbd>}
    {showPanel && <div className="global-search-panel" id={listId} role="listbox" aria-label="Search suggestions">
      <div className="global-search-status" aria-live="polite">
        {loading ? 'Searching VEYTOS…' : failed ? 'Live search is temporarily unavailable' : items.length ? `${items.length} ${items.length === 1 ? 'result' : 'results'} across VEYTOS` : 'No matching collections'}
      </div>
      {!loading && launchpadItems.length > 0 && <><div className="global-search-group">Launchpad <span>{launchpadItems.length}</span></div>{launchpadItems.map(result)}</>}
      {!loading && marketplaceItems.length > 0 && <><div className="global-search-group">Marketplace <span>{marketplaceItems.length}</span></div>{marketplaceItems.map(result)}</>}
      {!loading && !failed && <button id={`${listId}-${items.length}`} role="option" aria-selected={active === items.length} className="global-search-all" type="submit" onMouseEnter={() => setActive(items.length)}>
        <span>View all results for “{normalized}”</span><ArrowRight size={15} />
      </button>}
      {(failed || partial) && <p className="global-search-note">{failed ? 'Press Enter to search all collections.' : 'Some optional metadata is unavailable; verified results are still shown.'}</p>}
    </div>}
  </form>;
}
