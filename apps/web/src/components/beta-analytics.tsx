'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export type BetaEvent='page_view'|'wallet_connected'|'mint_started'|'mint_completed'|'listing_started'|'listing_completed'|'cancellation_completed'|'purchase_started'|'purchase_completed'|'collection_viewed'|'nft_viewed';
export function trackBetaEvent(name:BetaEvent,properties:Record<string,string|number|boolean>={}){if(typeof window==='undefined'||navigator.doNotTrack==='1')return;const body=JSON.stringify({name,properties,path:location.pathname});if(navigator.sendBeacon)navigator.sendBeacon('/api/analytics',new Blob([body],{type:'application/json'}));else void fetch('/api/analytics',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});}
export function BetaAnalytics(){const path=usePathname();useEffect(()=>trackBetaEvent('page_view'),[path]);return null;}
