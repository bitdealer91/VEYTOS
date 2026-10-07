'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import { discoverNFTByIdentity, type NormalizedNFT } from '@veytos/aptos/discovery';
import { decodeNFTIdentity, encodeNFTIdentity } from '@veytos/aptos/marketplace';
import type { ProfileMarketplaceListing } from '@/lib/marketplace-data';
import { config, marketplaceAddress, network } from '@/lib/config';
import { marketChain } from '@/lib/chain';
import { MARKETPLACE_SESSION_EVENT, readMarketplaceSession, writeMarketplaceSession, type MarketplaceSessionListing } from '@/lib/marketplace-session';
import { Artwork } from '@/components/artwork';
import { EmptyState, PriceDisplay } from '@/components/ui';
import { ProfileNFTAction } from '@/components/profile-nft-action';

type DisplayItem = {
  assetKey: string; standard: 'v1' | 'v2'; name: string; collectionName: string; metadataUri: string;
  listing: { id: string; price: string; indexed: boolean } | null;
};

function listedDisplay(item: ProfileMarketplaceListing): DisplayItem {
  const identity = decodeNFTIdentity(item.asset_key);
  return {
    assetKey: item.asset_key, standard: item.standard,
    name: item.nft?.name || (identity.standard === 'v1' ? identity.name : `Digital Asset ${identity.address.slice(0, 8)}…`),
    collectionName: item.nft?.collectionName || (identity.standard === 'v1' ? identity.collection : 'Aptos collection'),
    metadataUri: item.nft?.metadataUri || '', listing: { id: item.listing_id, price: item.price_octas, indexed: true },
  };
}

function sessionDisplay(item: MarketplaceSessionListing): DisplayItem {
  return { assetKey: item.assetKey, standard: item.nft.standard, name: item.nft.name, collectionName: item.nft.collectionName,
    metadataUri: item.nft.metadataUri, listing: { id: item.listingId, price: item.price, indexed: false } };
}

export function ProfileInventory({ owned, listings, profileAddress, emptyTitle = 'No supported NFTs found', emptyDescription = 'No wallet-held or actively listed NFTs are available.' }: { owned: NormalizedNFT[]; listings: ProfileMarketplaceListing[]; profileAddress: string; emptyTitle?: string; emptyDescription?: string }) {
  const [session, setSession] = useState<MarketplaceSessionListing[]>([]);
  useEffect(() => {
    const moduleAddress = marketplaceAddress;
    if (!moduleAddress) return;
    let mounted = true;
    const reconcile = async () => {
      const verified = new Map<string, MarketplaceSessionListing>();
      const snapshots = readMarketplaceSession(network, moduleAddress)
        .filter((item) => item.seller.toLowerCase() === profileAddress.toLowerCase()).slice(0, 12);
      await Promise.allSettled(snapshots.map(async (item) => {
        const identity = decodeNFTIdentity(item.assetKey);
        const state = await marketChain().assetState(identity, item.nft.collectionId, undefined, { retries: 0 });
        if (state.listing?.status === 'ACTIVE' && state.listing.seller.toLowerCase() === profileAddress.toLowerCase()) {
          verified.set(item.assetKey, { ...item, listingId: state.listing.id, price: state.listing.price, listedVersion: state.ledgerVersion });
          return;
        }
        writeMarketplaceSession(network, moduleAddress, null, item.assetKey);
      }));

      const prefix = `veytos:confirmed:${network}:${moduleAddress}:`;
      const routes: string[] = [];
      for (let index = 0; index < localStorage.length && routes.length < 12; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key) || '{}') as { action?: string; listingStatus?: string };
          if (value.action === 'list' && value.listingStatus !== 'SOLD') routes.push(key.slice(prefix.length));
        } catch {}
      }
      const indexerUrl = config.NEXT_PUBLIC_APTOS_INDEXER_URL || `https://api.${network}.aptoslabs.com/v1/graphql`;
      await Promise.allSettled(routes.map(async (route) => {
        const match = /^(0x[0-9a-f]{64}):$/i.exec(route);
        if (!match) return;
        const identity = { standard: 'v2' as const, address: match[1] };
        const nft = await discoverNFTByIdentity(indexerUrl, identity);
        if (!nft) return;
        const state = await marketChain().assetState(identity, nft.collectionId, undefined, { retries: 0 });
        if (!state.listing || state.listing.status !== 'ACTIVE' || state.listing.seller.toLowerCase() !== profileAddress.toLowerCase()) return;
        const recovered: MarketplaceSessionListing = {
          assetKey: encodeNFTIdentity(identity), collectionKey: `v2:${nft.collectionId}`, listingId: state.listing.id,
          seller: state.listing.seller, price: state.listing.price, listedVersion: state.ledgerVersion,
          nft: { standard: nft.standard, tokenId: nft.tokenId, collectionId: nft.collectionId, name: nft.name, metadataUri: nft.metadataUri, collectionName: nft.collectionName },
        };
        verified.set(recovered.assetKey, recovered);
        writeMarketplaceSession(network, moduleAddress, recovered, recovered.assetKey);
      }));
      if (mounted) setSession([...verified.values()]);
    };
    const refresh = () => setSession(readMarketplaceSession(network, moduleAddress)
      .filter((item) => item.seller.toLowerCase() === profileAddress.toLowerCase()));
    void reconcile(); window.addEventListener(MARKETPLACE_SESSION_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { mounted = false; window.removeEventListener(MARKETPLACE_SESSION_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [profileAddress]);
  const items = useMemo(() => {
    const merged = new Map<string, DisplayItem>();
    for (const nft of owned) merged.set(encodeNFTIdentity(nft.identity), {
      assetKey: encodeNFTIdentity(nft.identity), standard: nft.standard, name: nft.name || 'Unnamed NFT',
      collectionName: nft.collectionName || 'Unknown collection', metadataUri: nft.metadataUri, listing: null,
    });
    for (const listing of listings) merged.set(listing.asset_key, listedDisplay(listing));
    for (const listing of session) if (listing.seller.toLowerCase() === profileAddress.toLowerCase() && !merged.get(listing.assetKey)?.listing?.indexed) {
      merged.set(listing.assetKey, sessionDisplay(listing));
    }
    return [...merged.values()].sort((a, b) => Number(!!b.listing) - Number(!!a.listing));
  }, [listings, owned, profileAddress, session]);
  if (!items.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <div className="profile-nft-grid">{items.map((item) => {
    const href = `/nft/${item.assetKey}`;
    return <article className={`nft-card owned-nft-card ${item.listing ? 'is-listed' : ''}`} key={item.assetKey}>
      <Link className="profile-card-art" href={href}><Artwork uri={item.metadataUri} name={item.name} /><span>{item.standard === 'v1' ? 'V1' : 'V2'}</span>{item.listing && <b className="profile-listed-badge">Listed</b>}</Link>
      <div className="card-body"><p>{item.collectionName}</p><h2><Link href={href}>{item.name}</Link></h2>
        {item.listing && <div className="profile-listing-price"><span>{item.listing.indexed ? 'List price' : 'List price · indexing'}</span><PriceDisplay octas={item.listing.price} /></div>}
        <div className="profile-card-footer"><small className="muted">{item.standard === 'v1' ? 'Legacy Token' : 'Digital Asset'}</small>
          {item.listing ? <Link className="profile-card-action owner" href={href}><Tag size={13} /> Manage</Link> : <ProfileNFTAction profileAddress={profileAddress} href={href} />}
        </div>
      </div>
    </article>;
  })}</div>;
}
