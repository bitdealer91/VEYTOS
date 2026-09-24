import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canonical } from '@veytos/aptos/domain';
import { discoverOwnedNFTs } from '@veytos/aptos/discovery';
import type { NormalizedNFT } from '@veytos/aptos/discovery';
import { Artwork } from '@/components/artwork';
import { WalletAddress } from '@/components/chain-ui';
import { EmptyState, ErrorState } from '@/components/ui';
import { aptos } from '@/lib/chain';
import { network } from '@/lib/config';

export const dynamic = 'force-dynamic';
const DISPLAY_LIMIT = 48;

function identityLabel(nft: NormalizedNFT) {
  if (nft.identity.standard === 'v2') return nft.identity.address;
  return `${nft.identity.name} · property version ${nft.identity.propertyVersion}`;
}

function OwnedNFTCard({ nft }: { nft: NormalizedNFT }) {
  return <article className="nft-card owned-nft-card">
    <Artwork uri={nft.metadataUri} name={nft.name || 'Unnamed NFT'} />
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

export default async function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const rawAddress = (await params).address;
  let address: string;
  try { address = canonical(rawAddress); } catch { notFound(); }

  let result: Awaited<ReturnType<typeof discoverOwnedNFTs>>;
  try {
    result = await discoverOwnedNFTs(aptos, address);
  } catch {
    return <section className="profile-page">
      <div className="page-title"><span className="eyebrow">APTOS {network.toUpperCase()} WALLET</span><h1>NFT profile</h1><WalletAddress address={address} /></div>
      <ErrorState title="NFT ownership is temporarily unavailable" description="The Aptos Indexer did not return a complete wallet result. VEYTOS will not show a partial inventory as current ownership." />
    </section>;
  }

  const displayed = result.items.slice(0, DISPLAY_LIMIT);
  return <section className="profile-page">
    <div className="page-title profile-title">
      <div><span className="eyebrow">APTOS {network.toUpperCase()} WALLET</span><h1>NFT profile</h1><WalletAddress address={address} /></div>
      <div className="profile-count"><strong>{result.items.length}</strong><span>current NFT holdings</span></div>
    </div>
    <nav className="content-tabs" aria-label="Wallet sections"><a href="#owned">Owned <small>{result.items.length}</small></a></nav>
    <section id="owned" className="section">
      <div className="section-heading"><div><h2>Owned NFTs</h2><p className="muted">Current Indexer ownership across Token V1 and Digital Assets.</p></div></div>
      {displayed.length
        ? <><div className="profile-nft-grid">{displayed.map((nft) => <OwnedNFTCard key={`${nft.standard}:${nft.tokenId}:${nft.identity.standard === 'v1' ? nft.identity.propertyVersion : ''}`} nft={nft} />)}</div>
          {result.items.length > displayed.length && <p className="caption muted profile-limit">Showing the {DISPLAY_LIMIT} most recently changed of {result.items.length} holdings. Complete pagination is available in the discovery layer; profile pagination is a follow-up.</p>}</>
        : <EmptyState title="No supported NFTs found" description={`This wallet does not currently own Token V1 or Digital Asset NFTs indexed on Aptos ${network}.`} />}
      {result.rejectedRows > 0 && <p className="caption muted profile-limit">{result.rejectedRows} malformed Indexer {result.rejectedRows === 1 ? 'row was' : 'rows were'} omitted rather than guessed.</p>}
    </section>
  </section>;
}
