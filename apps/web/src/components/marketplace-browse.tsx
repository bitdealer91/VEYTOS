import Link from 'next/link';
import type { BrowseListing } from '@/lib/marketplace-data';
import { Artwork } from './artwork';
import { PriceDisplay } from './ui';
import { WalletAddress } from './chain-ui';
export function MarketplaceListingCard({item}:{item:BrowseListing}){const legacy=item.standard==='v1';return <article className="nft-card"><Link href={`/nft/${item.asset_key}`}><Artwork uri="" name={legacy?'Legacy Aptos NFT':'Aptos Digital Asset'}/></Link><div className="card-body"><span className="eyebrow">{legacy?'TOKEN V1 · LEGACY':'DIGITAL ASSET · V2'}</span><h3><Link href={`/nft/${item.asset_key}`}>{legacy?'Legacy Aptos NFT':'Aptos Digital Asset'}</Link></h3><p className="caption muted">Seller <WalletAddress address={item.seller_address}/></p><div className="between card-price"><span className="caption muted">Price</span><PriceDisplay octas={item.price_octas}/></div></div></article>}
export function MarketplaceListingGrid({items}:{items:BrowseListing[]}){return <div className="card-grid">{items.map(item=><MarketplaceListingCard key={item.listing_id} item={item}/>)}</div>}
