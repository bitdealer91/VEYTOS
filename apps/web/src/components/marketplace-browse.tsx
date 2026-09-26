import Link from 'next/link';
import type { BrowseListing } from '@/lib/marketplace-data';
import { Artwork } from './artwork';
import { PriceDisplay } from './ui';
import { WalletAddress } from './chain-ui';
import { decodeNFTIdentity } from '@veytos/aptos/marketplace';
export function MarketplaceListingCard({item}:{item:BrowseListing}){const identity=decodeNFTIdentity(item.asset_key);const legacy=identity.standard==='v1';const label=legacy?identity.name:`Digital Asset ${identity.address.slice(0,8)}…`;const collection=legacy?identity.collection:item.collection_key.replace(/^v2:/,'');return <article className="nft-card"><Link href={`/nft/${item.asset_key}`}><Artwork uri="" name={label}/></Link><div className="card-body"><span className="eyebrow">{legacy?'TOKEN V1 · LEGACY':'DIGITAL ASSET · V2'}</span><h3><Link href={`/nft/${item.asset_key}`}>{label}</Link></h3><p className="caption muted identity-line" title={collection}>{collection}</p><p className="caption muted">Seller <WalletAddress address={item.seller_address}/></p><div className="between card-price"><span className="caption muted">Price</span><PriceDisplay octas={item.price_octas}/></div></div></article>}
export function MarketplaceListingGrid({items}:{items:BrowseListing[]}){return <div className="card-grid">{items.map(item=><MarketplaceListingCard key={item.listing_id} item={item}/>)}</div>}
