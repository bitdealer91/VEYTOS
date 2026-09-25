'use client';
import { useEffect,useState } from 'react';
import { Grid2X2,List,Search } from 'lucide-react';
import { DropCard,CollectionsTable } from '@/components/cards';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/components/chain-ui';
import {dropStatus} from '@veytos/aptos/domain';
import type {Drop} from '@veytos/aptos/types';
export function Explore({drops,initialQuery='',initialStatus='All'}:{drops:Drop[];initialQuery?:string;initialStatus?:string}){
 const [query,setQuery]=useState(initialQuery),[status,setStatus]=useState(initialStatus),[sort,setSort]=useState('minted'),[view,setView]=useState('grid');const now=useNow();
 useEffect(()=>{try{setView(localStorage.getItem('veytos:view')==='table'?'table':'grid');}catch{}},[]);
 const list=drops.filter(d=>(d.terms.name.toLowerCase().includes(query.toLowerCase())||d.address.toLowerCase()===query.toLowerCase()||d.collection.toLowerCase()===query.toLowerCase())&&(status==='All'||(now&&dropStatus(d,now)===status))).sort((a,b)=>sort==='price'?Number(BigInt(a.terms.unit_price)-BigInt(b.terms.unit_price)):sort==='newest'?Number(BigInt(b.terms.start_seconds)-BigInt(a.terms.start_seconds)):Number(BigInt(b.minted)-BigInt(a.minted)));
 function changeView(value:string){setView(value);try{localStorage.setItem('veytos:view',value);}catch{}}
 return <><div className="explore-toolbar"><div className="filter-tabs" aria-label="Drop status">{['All','LIVE','UPCOMING','ENDED','SOLD OUT'].map(s=><button key={s} aria-pressed={s===status} onClick={()=>setStatus(s)}>{s==='All'?'All collections':s.toLowerCase().replace(/^./,c=>c.toUpperCase())}</button>)}</div><div className="explore-controls"><label className="search"><Search size={16}/><input aria-label="Filter collections" placeholder="Find a collection" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Sort collections" value={sort} onChange={e=>setSort(e.target.value)}><option value="minted">Most minted</option><option value="newest">Newest launch</option><option value="price">Mint price: low to high</option></select><div className="view-switch"><button aria-label="Grid view" aria-pressed={view==='grid'} onClick={()=>changeView('grid')}><Grid2X2 size={17}/></button><button aria-label="Table view" aria-pressed={view==='table'} onClick={()=>changeView('table')}><List size={17}/></button></div></div></div><p className="result-count">{list.length} {list.length===1?'collection':'collections'} <span>· Live on-chain data</span></p>{!list.length?<EmptyState title="No collections found" description="Try another name or status. New collections will appear here as they are added."/>:view==='table'?<CollectionsTable drops={list}/>:<div className="card-grid">{list.map(d=><DropCard key={d.address} drop={d}/>)}</div>}</>;
}
