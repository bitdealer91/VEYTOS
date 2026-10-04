import { Search } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { MarketplaceCollectionsTable } from '@/components/marketplace-collections';
import { marketplaceCollections } from '@/lib/marketplace-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketplace Collections' };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const params = await searchParams;
  const sort = ['floor-asc', 'floor-desc', 'volume', 'active', 'listed'].includes(params.sort || '') ? params.sort : 'volume';
  const result = await marketplaceCollections({ sort });
  const query = (params.q || '').trim().toLowerCase();
  const items = query ? result.items.filter((collection) =>
    collection.name.toLowerCase().includes(query) || collection.creatorName?.toLowerCase().includes(query) ||
    collection.creator.toLowerCase().includes(query) || collection.key.toLowerCase().includes(query)) : result.items;
  return <>
    <header className="market-collections-hero"><span className="eyebrow">APTOS · FIXED-PRICE MARKETPLACE</span><h1>Collections</h1><p>Discover and trade NFT collections on Aptos.</p></header>
    <section className="market-collections-section">
      <div className="market-collections-controls"><div className="market-collections-tab" aria-current="page">All Collections</div>
        <form><label><Search size={16} /><input name="q" defaultValue={params.q || ''} placeholder="Search collections" aria-label="Search marketplace collections" /></label>
          <select name="sort" defaultValue={sort} aria-label="Sort collections"><option value="volume">Volume (24h)</option><option value="active">Recently active</option><option value="listed">Most listed</option><option value="floor-asc">Floor: low to high</option><option value="floor-desc">Floor: high to low</option></select>
          <button className="button" type="submit">Apply</button>
        </form>
      </div>
      {result.metadataFailed && <p className="market-local-notice">Some optional collection artwork or metadata is unavailable. Trading metrics remain current.</p>}
      {items.length ? <MarketplaceCollectionsTable items={items} /> : <EmptyState
        title={result.failed ? 'Marketplace data is temporarily unavailable' : query ? 'No matching collections' : 'No marketplace collections yet'}
        description={result.failed ? 'The indexed browsing projection could not be reached. No inferred or stale metrics are shown.' : result.configured ? query ? 'Try a collection name, creator, or Aptos address.' : 'Launchpad collections appear here automatically; external collections appear after a valid VEYTOS listing.' : 'Marketplace discovery is not configured yet.'}
      />}
    </section>
  </>;
}
