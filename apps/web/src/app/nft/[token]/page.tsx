import { notFound } from 'next/navigation';
import { decodeNFTIdentity } from '@veytos/aptos/marketplace';
import { discoverNFTByIdentity } from '@veytos/aptos/discovery';
import { Artwork } from '@/components/artwork';
import { WalletAddress } from '@/components/chain-ui';
import { ErrorState, StatBlock } from '@/components/ui';
import { MarketplacePanel } from '@/features/marketplace-panel';
import { activeListingFor } from '@/lib/marketplace-data';
import { marketChain } from '@/lib/chain';
import { network } from '@/lib/config';

export const dynamic = 'force-dynamic';
const indexerUrl = `https://api.${network}.aptoslabs.com/v1/graphql`;
function visibleProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item)).slice(0, 40);
}

export default async function NFTPage({ params }: { params: Promise<{ token: string }> }) {
  let identity;
  try { identity = decodeNFTIdentity((await params).token); } catch { notFound(); }
  let nft;
  try { nft = await discoverNFTByIdentity(indexerUrl, identity); } catch {
    return <ErrorState title="NFT data is temporarily unavailable" description="The Aptos Indexer could not verify this asset identity and current owner." />;
  }
  if (!nft) notFound();
  const [listingResult, configResult] = await Promise.allSettled([activeListingFor(identity, nft.collectionId), marketChain().config()]);
  if (configResult.status === 'rejected') return <ErrorState title="Marketplace state is unavailable" description="Trading actions are hidden until VEYTOS can verify the on-chain fee and pause policy." />;
  if (listingResult.status === 'rejected') return <ErrorState title="Listing state is unavailable" description="VEYTOS could not verify the authoritative on-chain listing state. No trading action is shown until this read succeeds." />;
  const listing = listingResult.value;
  const properties = visibleProperties(nft.properties);
  const royalty = listing ? Number(listing.royaltyNumerator) / Number(listing.royaltyDenominator) * 100
    : nft.royalty ? Number(nft.royalty.numerator) / Number(nft.royalty.denominator) * 100 : null;
  return <section className="nft-detail">
    <div className="breadcrumb"><a href={`/profile/${listing?.seller || nft.owner}`}>{listing ? 'Seller' : 'Wallet'}</a><span>/</span><span>{nft.name}</span></div>
    <div className="nft-detail-layout">
      <div className="nft-art"><Artwork uri={nft.metadataUri} name={nft.name || 'Unnamed NFT'} large /></div>
      <div className="nft-information">
        <span className="eyebrow">{nft.standard === 'v1' ? 'TOKEN V1 · HISTORICAL' : 'DIGITAL ASSET · V2'}</span>
        <h1>{nft.name || 'Unnamed NFT'}</h1>
        <p className="muted">{nft.collectionName || 'Unknown collection'}</p>
        <div className="stats-row"><StatBlock label="Royalty">{royalty === null || !Number.isFinite(royalty) ? 'Unavailable' : `${royalty}%`}</StatBlock></div>
        {nft.description && <p className="collection-description">{nft.description}</p>}
        <MarketplacePanel nft={nft} initialListing={listing} initialConfig={configResult.value} />
        <section className="blockchain-details"><h2>Properties</h2>{properties.length ? <dl>{properties.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="muted">No readable properties are available for this NFT.</p>}</section>
        <section className="blockchain-details"><h2>Blockchain details</h2><dl>
          <div><dt>Network</dt><dd>Aptos {network}</dd></div>
          <div><dt>Token standard</dt><dd>{nft.standard === 'v1' ? 'Token V1' : 'Digital Asset V2'}</dd></div>
          <div><dt>Collection</dt><dd>{nft.collectionName}</dd></div>
          {identity.standard === 'v1' ? <><div><dt>Creator</dt><dd><WalletAddress address={identity.creator} /></dd></div><div><dt>Property version</dt><dd>{identity.propertyVersion}</dd></div></> : <div><dt>Object</dt><dd><WalletAddress address={identity.address} /></dd></div>}
          <div><dt>Metadata URI</dt><dd className="identity-line" title={nft.metadataUri}>{nft.metadataUri || 'Unavailable'}</dd></div>
        </dl></section>
      </div>
    </div>
  </section>;
}
