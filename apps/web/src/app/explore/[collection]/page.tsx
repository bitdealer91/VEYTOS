import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { Artwork } from '@/components/artwork';
import { CollectionLinks } from '@/components/collection-links';
import { WalletAddress } from '@/components/chain-ui';
import { MarketplaceCollectionStats, MarketplaceCollectionTrading } from '@/features/marketplace-collection';
import { marketplaceCollection, parseMarketplaceCollectionKey } from '@/lib/marketplace-data';
import { gatewayUrl } from '@/lib/metadata';
import { network } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketplace Collection' };

export default async function Page({ params }: { params: Promise<{ collection: string }> }) {
  const raw = (await params).collection;
  let key: string;
  try { key = decodeURIComponent(raw); } catch { notFound(); }
  if (!parseMarketplaceCollectionKey(key)) notFound();
  const result = await marketplaceCollection(key);
  if (!result) notFound();
  const { collection } = result;
  const banner = collection.bannerUri ? gatewayUrl(collection.bannerUri) : null;
  return <div className="market-collection-page">
    <div className="market-breadcrumb"><Link href="/explore">Marketplace</Link><span>/</span><span>{collection.name}</span></div>
    <header className={`market-collection-hero ${banner ? 'has-banner' : ''}`}>
      {banner && <img className="market-hero-banner" src={banner} alt="" />}
      <div className="market-hero-shade" />
      <div className="market-hero-identity"><div className="market-hero-avatar"><Artwork uri={collection.metadataUri} name={collection.name} large /></div>
        <div className="market-hero-copy"><div className="market-hero-title"><h1>{collection.name}</h1>{collection.verified && <BadgeCheck aria-label="Verified VEYTOS collection" />}</div>
          <div className="market-hero-byline"><span>By {collection.creatorName || <WalletAddress address={collection.creator} />}</span><span className="aptos-chip">Aptos {network}</span>{collection.native && <span className="native-mark"><i />VEYTOS native</span>}</div>
          {collection.description && <p>{collection.description}</p>}
          <CollectionLinks uri={collection.metadataUri} links={collection.links} />
        </div>
      </div>
      <MarketplaceCollectionStats collectionKey={collection.key} items={result.items} floorPrice={collection.floorPrice}
        activeListings={collection.activeListings} supply={collection.supply} totalVolume={collection.totalVolume} />
    </header>
    {result.metadataFailed && <p className="market-local-notice">Some optional collection media or profile details are unavailable. Indexed listings are unaffected.</p>}
    {result.failed && <p className="market-local-notice error">Marketplace inventory is temporarily unavailable. No stale listing state is shown.</p>}
    <MarketplaceCollectionTrading collectionKey={collection.key} items={result.items} events={result.events} inventoryFailed={result.inventoryFailed} inventoryLimited={collection.supply !== null && BigInt(collection.supply) > 100n} activityFailed={result.failed} />
  </div>;
}
