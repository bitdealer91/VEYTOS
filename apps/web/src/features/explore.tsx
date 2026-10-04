'use client';
import {useState} from 'react';
import {DropCard} from '@/components/cards';
import {EmptyState} from '@/components/ui';
import {useNow} from '@/components/chain-ui';
import {dropStatus} from '@veytos/aptos/domain';
import type {Drop} from '@veytos/aptos/types';

type Status='ALL'|'LIVE'|'UPCOMING'|'ENDED';
export function Explore({drops,initialQuery=''}:{drops:Drop[];initialQuery?:string}){
  const[status,setStatus]=useState<Status>('ALL');const now=useNow();
  const query=initialQuery.trim().toLowerCase();const list=drops.filter(drop=>{if(query&&!drop.terms.name.toLowerCase().includes(query)&&drop.address.toLowerCase()!==query&&drop.collection.toLowerCase()!==query)return false;if(status==='ALL'||!now)return true;const current=dropStatus(drop,now);return status==='ENDED'?current==='ENDED'||current==='SOLD OUT':current===status;});
  return <><div className="launch-filters" aria-label="Drop status">{(['ALL','LIVE','UPCOMING','ENDED'] as Status[]).map(value=><button key={value} aria-pressed={value===status} onClick={()=>setStatus(value)}>{value==='ALL'?'All':value[0]+value.slice(1).toLowerCase()}</button>)}</div><p className="result-count">{list.length} {list.length===1?'drop':'drops'} <span>· Fresh Aptos state</span></p>{list.length?<div className="launch-grid">{list.map(drop=><DropCard key={drop.address} drop={drop}/>)}</div>:<EmptyState title="No drops in this stage" description="Try another status. VEYTOS shows only launches backed by real on-chain data."/>}</>;
}
