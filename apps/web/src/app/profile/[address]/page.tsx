import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canonical } from '@veytos/aptos/domain';
import { discoverOwnedNFTPage } from '@veytos/aptos/discovery';
import type { NormalizedNFT } from '@veytos/aptos/discovery';
import { encodeNFTIdentity } from '@veytos/aptos/marketplace';
import Link from 'next/link';
import { Artwork } from '@/components/artwork';
import { WalletAddress } from '@/components/chain-ui';
import { EmptyState, ErrorState, PriceDisplay } from '@/components/ui';
import { aptos } from '@/lib/chain';
import { explorer, network } from '@/lib/config';
import { walletMarketplaceProjection } from '@/lib/marketplace-data';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 24;

function identityLabel(nft: NormalizedNFT) {
  if (nft.identity.standard === 'v2') return nft.identity.address;
  return `${nft.identity.name} · property version ${nft.identity.propertyVersion}`;
}

function OwnedNFTCard({ nft }: { nft: NormalizedNFT }) {
  return <article className="nft-card owned-nft-card">
    <Link href={`/nft/${encodeNFTIdentity(nft.identity)}`}><Artwork uri={nft.metadataUri} name={nft.name || 'Unnamed NFT'} /></Link>
    <div className="card-body">
      <span className="eyebrow">{nft.standard === 'v1' ? 'TOKEN V1 · LEGACY' : 'DIGITAL ASSET · V2'}</span>
      <h2>{nft.name || 'Unnamed NFT'}</h2>
      <p>{nft.collectionName || 'Unknown collection'}</p>
      <small className="muted identity-line" title={identityLabel(nft)}>{identityLabel(nft)}</small>
    </div>
  </article>;
}

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  return { title: `Wallet ${address.slice(0, 8)}…`, description: `NFTs currently owned by this wallet on Aptos ${network}.` };
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ address: string }>; searchParams: Promise<{ offset?: string; tab?: string;marketOffset?:string }> }) {
  const rawAddress = (await params).address;
  let address: string;
  try { address = canonical(rawAddress); } catch { notFound(); }

  const query = await searchParams;
  const tab = ['owned', 'listed', 'activity'].includes(query.tab || '') ? query.tab! : 'owned';
  const rawOffset = query.offset || '0';
  const offset = /^\d+$/.test(rawOffset) ? Number(rawOffset) : 0;
  const marketOffset=/^\d+$/.test(query.marketOffset||'')?Number(query.marketOffset):0;
  if (!Number.isSafeInteger(offset) || offset < 0) notFound();
  let result: Awaited<ReturnType<typeof discoverOwnedNFTPage>>={items:[],rejectedRows:0,pages:0,offset,hasMore:false};
  try {
    if(tab==='owned')result = await discoverOwnedNFTPage(aptos, address, { offset, pageSize: PAGE_SIZE });
  } catch {
    return <section className="profile-page">
      <div className="page-title"><span className="eyebrow">APTOS {network.toUpperCase()} WALLET</span><h1>NFT profile</h1><WalletAddress address={address} /></div>
      <ErrorState title="NFT ownership is temporarily unavailable" description="The Aptos Indexer did not return a complete wallet result. VEYTOS will not show a partial inventory as current ownership." />
    </section>;
  }

  const [displayed, projection] = [result.items, await walletMarketplaceProjection(address,marketOffset,PAGE_SIZE)];
  return <section className="profile-page">
    <div className="page-title profile-title">
      <div><span className="eyebrow">APTOS {network.toUpperCase()} WALLET</span><h1>NFT profile</h1><WalletAddress address={address} /></div>
      {tab==='owned'&&<div className="profile-count"><strong>{offset + result.items.length}{result.hasMore ? '+' : ''}</strong><span>indexed holdings</span></div>}
    </div>
    <nav className="content-tabs" aria-label="Wallet sections"><Link aria-current={tab === 'owned' ? 'page' : undefined} href={`/profile/${address}`}>Owned</Link><Link aria-current={tab === 'listed' ? 'page' : undefined} href={`/profile/${address}?tab=listed`}>Listed</Link><Link aria-current={tab === 'activity' ? 'page' : undefined} href={`/profile/${address}?tab=activity`}>Activity</Link></nav>
    {tab === 'owned' && <section id="owned" className="section">
      <div className="section-heading"><div><h2>Owned NFTs</h2><p className="muted">Current Indexer ownership across Token V1 and Digital Assets.</p></div></div>
      {displayed.length
        ? <><div className="profile-nft-grid">{displayed.map((nft) => <OwnedNFTCard key={`${nft.standard}:${nft.tokenId}:${nft.identity.standard === 'v1' ? nft.identity.propertyVersion : ''}`} nft={nft} />)}</div>
          <nav className="profile-pagination" aria-label="NFT pages">
            {offset > 0 && <Link className="button" href={`/profile/${address}?offset=${Math.max(0, offset - PAGE_SIZE)}`}>Previous</Link>}
            {result.hasMore && <Link className="button" href={`/profile/${address}?offset=${offset + PAGE_SIZE}`}>Next</Link>}
          </nav></>
        : <EmptyState title="No supported NFTs found" description={`This wallet does not currently own Token V1 or Digital Asset NFTs indexed on Aptos ${network}.`} />}
      {result.rejectedRows > 0 && <p className="caption muted profile-limit">{result.rejectedRows} malformed Indexer {result.rejectedRows === 1 ? 'row was' : 'rows were'} omitted rather than guessed.</p>}
    </section>}
    {tab === 'listed' && <section className="section"><div className="section-heading"><h2>Active listings</h2></div>{projection.listings.length ? <><div className="table-wrap"><table><thead><tr><th>Standard</th><th>Asset</th><th>Price</th></tr></thead><tbody>{projection.listings.map((item) => <tr key={String(item.listing_id)}><td>{String(item.standard).toUpperCase()}</td><td><Link href={`/nft/${item.asset_key}`}>Listing #{String(item.listing_id)}</Link></td><td><PriceDisplay octas={String(item.price_octas)} /></td></tr>)}</tbody></table></div><ProjectionPagination address={address} tab="listed" offset={marketOffset} more={projection.listingsMore}/></> : <EmptyState title="No active listings" description={projection.configured ? 'This wallet has no active VEYTOS listings.' : 'The marketplace projection is not configured in this environment.'} />}</section>}
    {tab === 'activity' && <section className="section"><div className="section-heading"><h2>Marketplace activity</h2></div>{projection.events.length ? <><div className="table-wrap"><table><thead><tr><th>Event</th><th>Asset</th><th>Price</th><th>Transaction</th></tr></thead><tbody>{projection.events.map((event) => <tr key={`${event.transaction_version}:${event.event_index}`}><td>{String(event.event_type)}</td><td><Link href={`/nft/${event.asset_key}`}>Listing #{String(event.listing_id)}</Link></td><td>{event.gross_price_octas ? <PriceDisplay octas={String(event.gross_price_octas)} /> : '—'}</td><td><a href={explorer('txn', String(event.transaction_hash))} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div><ProjectionPagination address={address} tab="activity" offset={marketOffset} more={projection.eventsMore}/></> : <EmptyState title="No marketplace activity" description={projection.configured ? 'No VEYTOS events involve this wallet yet.' : 'The marketplace projection is not configured in this environment.'} />}</section>}
  </section>;
}
function ProjectionPagination({address,tab,offset,more}:{address:string;tab:'listed'|'activity';offset:number;more:boolean}){return <nav className="profile-pagination" aria-label={`${tab} pages`}>{offset>0&&<Link className="button" href={`/profile/${address}?tab=${tab}&marketOffset=${Math.max(0,offset-PAGE_SIZE)}`}>Previous</Link>}{more&&<Link className="button" href={`/profile/${address}?tab=${tab}&marketOffset=${offset+PAGE_SIZE}`}>Next</Link>}</nav>}
