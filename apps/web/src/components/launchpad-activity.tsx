'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {LaunchpadMintActivity} from '@/lib/data';
import {WalletAddress} from './chain-ui';
import {PriceDisplay} from './ui';

type Sale={event_type?:unknown;asset_key?:unknown;seller_address?:unknown;buyer_address?:unknown;gross_price_octas?:unknown;chain_timestamp?:unknown};
function ago(value:unknown){if(typeof value!=='string')return null;const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(!Number.isFinite(seconds))return null;if(seconds<60)return `${seconds}s ago`;if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;return `${Math.floor(seconds/86400)}d ago`;}
export function LaunchpadActivity({mints,mintsConfigured,mintsFailed,sales,salesConfigured,salesFailed}:{mints:LaunchpadMintActivity[];mintsConfigured:boolean;mintsFailed:boolean;sales:Sale[];salesConfigured:boolean;salesFailed:boolean}){
  const purchased=sales.filter(event=>event.event_type==='PURCHASED');const hasSales=salesConfigured||purchased.length>0||salesFailed;const[tab,setTab]=useState<'mints'|'sales'>('mints');const active=tab==='sales'&&hasSales?'sales':'mints';
  return <aside className="activity-rail" aria-label="Launchpad activity"><div className="activity-tabs" role="tablist"><button role="tab" aria-selected={active==='mints'} onClick={()=>setTab('mints')}>Live mints</button>{hasSales&&<button role="tab" aria-selected={active==='sales'} onClick={()=>setTab('sales')}>Recent sales</button>}</div>
    {active==='mints'?(mintsFailed?<ActivityMessage title="Mint activity unavailable" body="The drop remains mintable from fresh Aptos state."/>:mints.length?<div className="activity-list">{mints.map(event=><article key={`${event.version}:${event.serial}`}><div><WalletAddress address={event.buyer}/><p>Minted NFT #{event.serial}</p></div><time>{ago(event.chainTimestamp)??'Confirmed'}</time></article>)}</div>:!mintsConfigured?<ActivityMessage title="Indexed activity is not connected" body="This environment has no PostgreSQL activity projection configured."/>:<ActivityMessage title="No mints indexed yet" body="Confirmed mints will appear here without synthetic activity."/>):(salesFailed?<ActivityMessage title="Sales activity unavailable" body="Marketplace history is optional and does not affect minting."/>:purchased.length?<div className="activity-list">{purchased.map((event,index)=><article key={`${String(event.asset_key)}:${index}`}><div><Link href={`/nft/${String(event.asset_key)}`}>Digital Asset</Link><p>{event.gross_price_octas?<PriceDisplay octas={String(event.gross_price_octas)}/>:'Sale confirmed'}</p></div><time>{ago(event.chain_timestamp)??'Confirmed'}</time></article>)}</div>:<ActivityMessage title="No recent sales" body="Secondary sales will appear after they are indexed."/>)}
  </aside>;
}
function ActivityMessage({title,body}:{title:string;body:string}){return <div className="activity-empty"><strong>{title}</strong><p>{body}</p></div>;}
