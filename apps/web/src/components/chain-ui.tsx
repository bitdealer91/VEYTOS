'use client';
import { useEffect,useState } from 'react';
import { Copy,Check } from 'lucide-react';
import { countdown,dropStatus } from '@veytos/aptos/domain';
import type {Drop} from '@veytos/aptos/types';
import {explorer} from '@/lib/config';
export function WalletAddress({address,kind='account'}:{address:string;kind?:'account'|'object'|'txn'}){const[copied,setCopied]=useState(false);return <span className="address"><a href={explorer(kind,address)} target="_blank" rel="noreferrer" title={address}>{address.slice(0,6)}…{address.slice(-4)}</a><button className="copy-button" aria-label="Copy address" onClick={async()=>{try{await navigator.clipboard.writeText(address);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}}}>{copied?<Check size={13}/>:<Copy size={13}/>}</button></span>;}
export function useNow(){const [now,setNow]=useState<bigint|null>(null);useEffect(()=>{setNow(BigInt(Math.floor(Date.now()/1000)));const timer=setInterval(()=>setNow(BigInt(Math.floor(Date.now()/1000))),1000);return()=>clearInterval(timer);},[]);return now;}
export function DropStatus({drop}:{drop:Drop}){const now=useNow();const status=now?dropStatus(drop,now):'…';return <span className={`status ${status==='LIVE'?'live':''}`}><i/>{status}</span>;}
export function Countdown({target}:{target:string}){const now=useNow();return <span>{now?countdown(BigInt(target),now):'…'}</span>;}
export function MintProgress({minted,supply}:{minted:string;supply:string}){return <div className="mint-progress"><div><span>{minted} minted</span><span>{supply} total</span></div><progress value={Number(minted)} max={Number(supply)} aria-label={`${minted} of ${supply} minted`}/></div>;}
