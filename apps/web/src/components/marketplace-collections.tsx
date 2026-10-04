import Link from 'next/link';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import type { MarketplaceCollectionSummary } from '@/lib/marketplace-data';
import { Artwork } from './artwork';
import { PriceDisplay } from './ui';

function collectionHref(key: string) {
  return `/explore/${encodeURIComponent(key)}`;
}

export function MarketplaceCollectionsTable({ items }: { items: MarketplaceCollectionSummary[] }) {
  return <div className="market-collection-table-wrap"><table className="market-collection-table">
    <thead><tr>
      <th scope="col">Collection</th>
      <th scope="col" className="numeric">Floor price</th>
      <th scope="col" className="numeric">Listed</th>
      <th scope="col" className="numeric optional-column">Volume (24h)</th>
      <th scope="col" className="numeric optional-column">Sales (24h)</th>
      <th scope="col" className="numeric optional-column">Supply</th>
      <th scope="col"><span className="sr-only">Open collection</span></th>
    </tr></thead>
    <tbody>{items.map((collection) => <tr key={collection.key}>
      <td><Link className="market-collection-identity" href={collectionHref(collection.key)}>
        <span className="market-collection-avatar"><Artwork uri={collection.metadataUri} name={collection.name} /></span>
        <span className="market-collection-copy"><span><strong>{collection.name}</strong>{collection.verified && <BadgeCheck size={14} aria-label="Verified VEYTOS collection" />}</span>
          <small>{collection.creatorName || `${collection.creator.slice(0, 8)}…${collection.creator.slice(-4)}`}{collection.native && <em>VEYTOS native</em>}</small>
        </span>
      </Link></td>
      <td className="numeric">{collection.floorPrice ? <PriceDisplay octas={collection.floorPrice} /> : <span className="market-dash">—</span>}</td>
      <td className="numeric">{collection.activeListings}</td>
      <td className="numeric optional-column"><PriceDisplay octas={collection.volume24h} /></td>
      <td className="numeric optional-column">{collection.sales24h}</td>
      <td className="numeric optional-column">{collection.supply ?? '—'}</td>
      <td><Link className="market-row-link" aria-label={`Open ${collection.name}`} href={collectionHref(collection.key)}><ArrowUpRight size={17} /></Link></td>
    </tr>)}</tbody>
  </table></div>;
}
