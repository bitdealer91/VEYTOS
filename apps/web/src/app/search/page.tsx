import { Search } from 'lucide-react';
import { DropCard } from '@/components/cards';
import { MarketplaceCollectionsTable } from '@/components/marketplace-collections';
import { EmptyState } from '@/components/ui';
import { discovery } from '@/lib/data';
import { marketplaceCollections } from '@/lib/marketplace-data';
import { searchLaunchpadDrops, searchMarketplaceCollections } from '@/lib/marketplace-search';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim() || '';
  const [launchpad, marketplace] = await Promise.all([
    discovery(),
    marketplaceCollections({ sort: 'active', limit: 100 }),
  ]);
  const launchpadMatches = searchLaunchpadDrops(launchpad.drops, query, BigInt(Math.floor(Date.now() / 1000)), 100);
  const marketplaceMatches = searchMarketplaceCollections(marketplace.items, query, 100);
  const dropsByAddress = new Map(launchpad.drops.map((drop) => [drop.address, drop]));
  const collectionsByKey = new Map(marketplace.items.map((collection) => [collection.key, collection]));
  const drops = launchpadMatches.flatMap((match) => dropsByAddress.get(match.address) ? [dropsByAddress.get(match.address)!] : []);
  const collections = marketplaceMatches.flatMap((match) => collectionsByKey.get(match.key) ? [collectionsByKey.get(match.key)!] : []);
  const count = drops.length + collections.length;

  return <div className="global-results-page">
    <header className="market-collections-hero"><span className="eyebrow">VEYTOS SEARCH</span><h1>Search collections</h1><p>Find collections across Launchpad and Marketplace.</p></header>
    <form className="global-results-form" action="/search"><label><Search size={17} /><input name="q" defaultValue={query} aria-label="Search all collections" placeholder="Name, creator, drop or collection address" autoFocus /></label><button className="button primary" type="submit">Search</button></form>
    {query.length < 2 ? <EmptyState title="Search across VEYTOS" description="Enter at least two characters to find Launchpad drops and Marketplace collections." />
      : count === 0 ? <EmptyState title="No matching collections" description="Try another name, creator, drop address, or collection address." />
        : <><p className="global-results-summary">{count} {count === 1 ? 'result' : 'results'} for “{query}” across VEYTOS</p>
          {drops.length > 0 && <section className="global-results-section"><div className="section-heading"><div><span className="eyebrow">LAUNCHPAD</span><h2>Drops</h2></div><span>{drops.length}</span></div><div className="launch-grid">{drops.map((drop) => <DropCard key={drop.address} drop={drop} />)}</div></section>}
          {collections.length > 0 && <section className="global-results-section"><div className="section-heading"><div><span className="eyebrow">MARKETPLACE</span><h2>Collections</h2></div><span>{collections.length}</span></div><MarketplaceCollectionsTable items={collections} /></section>}
        </>}
    {(launchpad.errors > 0 || marketplace.failed || marketplace.metadataFailed) && <p className="market-local-notice">Some optional collection data is unavailable. Confirmed results are still shown.</p>}
  </div>;
}
