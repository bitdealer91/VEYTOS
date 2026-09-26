import Link from 'next/link';
import { EmptyState, PriceDisplay } from '@/components/ui';
import { marketplaceActivity } from '@/lib/marketplace-data';
import { explorer } from '@/lib/config';
import { recordedActivity } from '@/lib/data';
import { WalletAddress } from '@/components/chain-ui';

export const dynamic = 'force-dynamic';
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const requested = (await searchParams).type?.toUpperCase() || 'ALL';
  const accepted = ['ALL', 'LISTED', 'PURCHASED', 'CANCELLED', 'MINT'];
  const filter = accepted.includes(requested) ? requested : 'ALL';
  const [marketResult, mintResult] = await Promise.all([marketplaceActivity(), recordedActivity()]);
  const mintEvents = mintResult.events.map((event, eventIndex) => ({ event_type: 'MINT', listing_id: '', standard: 'v2', asset_key: '', seller_address: event.creator, buyer_address: event.buyer, gross_price_octas: event.unit_price, transaction_hash: event.hash, transaction_version: event.version, event_index: eventIndex, token_address: event.token,chain_timestamp:new Date(Number(event.timestamp)*1000).toISOString() }));
  const events = [...marketResult.events, ...mintEvents].sort((a, b) => BigInt(String(a.transaction_version)) > BigInt(String(b.transaction_version)) ? -1 : 1);
  const visible = filter === 'ALL' ? events : events.filter((event) => event.event_type === filter);
  return <section><div className="page-title"><span className="eyebrow">ON-CHAIN ACTIVITY</span><h1>Marketplace activity</h1><p>Verified VEYTOS marketplace events indexed from Aptos.</p></div>
    <nav className="filter-tabs" aria-label="Activity filters">{accepted.map((value) => <Link key={value} aria-current={filter === value ? 'page' : undefined} href={value === 'ALL' ? '/activity' : `/activity?type=${value}`}>{value === 'PURCHASED' ? 'Sales' : value === 'LISTED' ? 'Listings' : value === 'CANCELLED' ? 'Cancellations' : value === 'MINT' ? 'Mints' : 'All'}</Link>)}</nav>
    {(marketResult.failed||mintResult.failed)&&<p className="notice warning">Some marketplace data is temporarily unavailable. Trading actions continue to verify Aptos directly.</p>}
    {visible.length ? <div className="table-wrap"><table><thead><tr><th>Event</th><th>Asset</th><th className="optional-column">Wallet</th><th>Price</th><th className="optional-column">Time</th><th>Transaction</th></tr></thead><tbody>{visible.map((event) => <tr key={`${event.transaction_version}:${event.event_index}:${event.event_type}`}><td>{event.event_type}</td><td>{event.event_type === 'MINT' && 'token_address' in event ? <a href={explorer('object', String(event.token_address))} target="_blank" rel="noreferrer">Minted NFT ↗</a> : <Link href={`/nft/${event.asset_key}`}>{String(event.standard).toUpperCase()} NFT</Link>}</td><td className="optional-column"><WalletAddress address={String(event.buyer_address || event.seller_address)}/></td><td>{event.gross_price_octas ? <PriceDisplay octas={String(event.gross_price_octas)} /> : '—'}</td><td className="optional-column">{'chain_timestamp' in event&&event.chain_timestamp?<time dateTime={String(event.chain_timestamp)}>{new Date(String(event.chain_timestamp)).toLocaleString()}</time>:'—'}</td><td><a className="text-link" href={explorer('txn', String(event.transaction_hash))} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div>
      : <EmptyState title="No marketplace activity indexed yet" description="The activity projection is empty. VEYTOS does not generate artificial listings or sales." />}
  </section>;
}
