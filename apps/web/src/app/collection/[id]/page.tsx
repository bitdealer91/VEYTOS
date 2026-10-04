import Link from 'next/link';
import {notFound} from 'next/navigation';
import {canonical} from '@veytos/aptos/domain';
import {network} from '@/lib/config';
import {launchpadActivityFor,launchpadDetail} from '@/lib/data';
import {collectionMarketplaceProjection} from '@/lib/marketplace-data';
import {Artwork} from '@/components/artwork';
import {CollectionLinks} from '@/components/collection-links';
import {WalletAddress,DropStatus} from '@/components/chain-ui';
import {ErrorState} from '@/components/ui';
import {RetryLaunchpad} from '@/components/retry-launchpad';
import {LaunchpadActivity} from '@/components/launchpad-activity';
import {MintPanel} from '@/features/mint-panel';

export const dynamic='force-dynamic';
export async function generateMetadata(){return {title:'Launchpad drop',description:`A native VEYTOS NFT drop on Aptos ${network}.`};}

export default async function Page({params}:{params:Promise<{id:string}>}){
  const raw=(await params).id;let id:string;try{id=canonical(raw);}catch{notFound();}
  const critical=await launchpadDetail(id);
  if(!critical.ok){const diagnostic=critical.reason==='network_mismatch'?'The configured Aptos network does not match this deployment.':critical.reason==='package_mismatch'?'The server and browser Launchpad package addresses do not match.':critical.reason==='malformed_chain_response'?'Aptos returned an unexpected Drop response.':critical.reason==='stale_chain_state'?'The connected fullnode is behind, so VEYTOS will not label its mint state as live.':'Fresh authoritative mint state could not be obtained.';return <section className="drop-unavailable"><ErrorState description={`${diagnostic} Reference ${critical.requestId}.`}/><RetryLaunchpad/></section>;}
  const drop=critical.snapshot.drop;
  const[mints,market]=await Promise.all([launchpadActivityFor(drop.address),collectionMarketplaceProjection(drop.collection)]);
  return <><div className="breadcrumb"><Link href="/drops">Launchpad</Link><span>/</span><span>{drop.terms.name}</span></div><div className="drop-layout">
    <aside className="drop-identity"><div className="drop-cover"><Artwork uri={drop.terms.collection_uri} name={drop.terms.name} large/></div><p>{drop.terms.description}</p><div className="drop-creator"><span>Created by</span><WalletAddress address={drop.terms.creator}/></div><CollectionLinks uri={drop.terms.collection_uri}/></aside>
    <section className="drop-main"><header className="drop-header"><div className="between"><span className="native-mark"><i/>VEYTOS native</span><DropStatus drop={drop}/></div><h1>{drop.terms.name}</h1><div className="drop-tags"><span>Aptos {network}</span><span>{Number(drop.terms.royalty_bps)/100}% creator royalty</span></div></header><MintPanel initial={drop}/></section>
    <LaunchpadActivity mints={mints.events} mintsConfigured={mints.configured} mintsFailed={mints.failed} sales={market.events} salesConfigured={market.configured} salesFailed={market.failed}/>
  </div></>;
}
