import Link from 'next/link';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { dropStatus } from '@veytos/aptos/domain';
import type { Drop } from '@veytos/aptos/types';
import { Artwork } from '@/components/artwork';
import { Countdown, DropActionLabel, DropStatus, MintProgress } from '@/components/chain-ui';
import { PriceDisplay } from '@/components/ui';
import { discovery } from '@/lib/data';
import { marketplaceCollections, type MarketplaceCollectionSummary } from '@/lib/marketplace-data';

export const dynamic = 'force-dynamic';

function collectionHref(collection: MarketplaceCollectionSummary) {
  return `/explore/${encodeURIComponent(collection.key)}`;
}

function DropTiming({ drop, status }: { drop: Drop; status: ReturnType<typeof dropStatus> }) {
  if (status === 'UPCOMING') return <Countdown target={drop.terms.start_seconds} />;
  if (status === 'LIVE') {
    return drop.terms.end_seconds === '0' ? <>Until sold out</> : <Countdown target={drop.terms.end_seconds} />;
  }
  if (status === 'SOLD OUT') return <>Sold out</>;
  return <>Closed</>;
}

function MarketplaceTable({ items }: { items: MarketplaceCollectionSummary[] }) {
  return <div className="home-market-table-wrap">
    <table className="home-market-table">
      <thead><tr>
        <th scope="col"><span className="sr-only">Rank</span></th>
        <th scope="col">Collection</th>
        <th scope="col">Floor price</th>
        <th scope="col">24h volume</th>
        <th scope="col">Listed</th>
        <th scope="col"><span className="sr-only">Open</span></th>
      </tr></thead>
      <tbody>{items.map((collection, index) => <tr key={collection.key}>
        <td className="home-market-rank">{index + 1}</td>
        <td><Link className="home-market-identity" href={collectionHref(collection)}>
          <span className="home-market-avatar"><Artwork uri={collection.metadataUri} name={collection.name} /></span>
          <span className="home-market-name"><strong>{collection.name}</strong>{collection.verified && <BadgeCheck size={14} aria-label="Verified VEYTOS collection" />}</span>
        </Link></td>
        <td className="numeric">{collection.floorPrice ? <PriceDisplay octas={collection.floorPrice} /> : <span className="market-dash">—</span>}</td>
        <td className="numeric"><PriceDisplay octas={collection.volume24h} /></td>
        <td className="numeric">{collection.activeListings}</td>
        <td><Link className="home-row-open" href={collectionHref(collection)} aria-label={`Open ${collection.name}`}><ArrowRight size={16} /></Link></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export default async function Home() {
  const [launchpad, marketplace] = await Promise.all([
    discovery(),
    marketplaceCollections({ sort: 'volume', limit: 6 }),
  ]);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const featured = launchpad.featured
    ?? launchpad.drops.find((drop) => dropStatus(drop, now) === 'LIVE')
    ?? launchpad.drops.find((drop) => dropStatus(drop, now) === 'UPCOMING')
    ?? launchpad.drops[0];
  const status = featured ? dropStatus(featured, now) : null;

  return <div className="home-dashboard">
    <section className="home-launch" aria-labelledby="home-launch-title">
      <header className="home-section-head">
        <span className="eyebrow">LAUNCHPAD</span>
        <h1 id="home-launch-title">Active Collection</h1>
        <p>Curated drops on Aptos. Real assets, direct ownership.</p>
      </header>

      {featured && status ? <article className="home-drop">
        <div className="home-drop-art">
          <Artwork uri={featured.terms.collection_uri} name={featured.terms.name} large />
          <div className="home-drop-shade" aria-hidden="true" />
          <div className="home-drop-status"><DropStatus drop={featured} /></div>
        </div>
        <div className="home-drop-copy">
          <span className="eyebrow">FEATURED ON VEYTOS</span>
          <h2>{featured.terms.name}</h2>
          <p>{featured.terms.description}</p>
          <MintProgress minted={featured.minted} supply={featured.terms.max_supply} />
          <div className="home-drop-facts">
            <div><span>Price</span><strong><PriceDisplay octas={featured.terms.unit_price} /></strong></div>
            <div><span>Supply</span><strong>{featured.terms.max_supply}</strong></div>
            <div><span>Minted</span><strong>{featured.minted}</strong></div>
            <div><span>{status === 'UPCOMING' ? 'Starts in' : 'Availability'}</span><strong><DropTiming drop={featured} status={status} /></strong></div>
          </div>
          <div className="home-drop-actions">
            <Link className="button primary" href={`/collection/${featured.address}`}><DropActionLabel drop={featured} /><ArrowRight size={17} /></Link>
            <Link className="button" href="/drops">All drops</Link>
          </div>
        </div>
      </article> : <div className="home-local-empty">
        <span className="eyebrow">NO ACTIVE DROP</span>
        <h2>The next collection will appear here.</h2>
        <p>VEYTOS does not fill launchpad space with fictional projects.</p>
        <Link className="button" href="/drops">View Launchpad</Link>
      </div>}
      {launchpad.errors > 0 && <p className="home-data-note">Some optional launchpad data is temporarily unavailable.</p>}
    </section>

    <section className="home-market" aria-labelledby="home-market-title">
      <header className="home-section-head home-market-head">
        <div>
          <span className="eyebrow">MARKETPLACE</span>
          <h2 id="home-market-title">Top Collections</h2>
          <p>By completed 24h trading volume on VEYTOS.</p>
        </div>
        <Link className="button home-explore" href="/explore">Explore Marketplace <ArrowRight size={16} /></Link>
      </header>

      {marketplace.items.length > 0 ? <MarketplaceTable items={marketplace.items} /> : <div className="home-local-empty home-market-empty">
        <span className="eyebrow">MARKETPLACE</span>
        <h2>No indexed collections yet.</h2>
        <p>{marketplace.failed ? 'The marketplace projection is temporarily unavailable.' : 'Collections appear after launch or their first marketplace activity.'}</p>
        <Link className="button" href="/explore">Open Marketplace</Link>
      </div>}
      {(marketplace.failed || marketplace.metadataFailed) && marketplace.items.length > 0 && <p className="home-data-note">Some optional marketplace metadata is temporarily unavailable.</p>}
    </section>
  </div>;
}
