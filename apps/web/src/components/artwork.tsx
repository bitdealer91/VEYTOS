'use client';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { loadMetadata } from '@/lib/metadata';
export function Artwork({uri,name,large=false}:{uri:string;name:string;large?:boolean}){
  const patternId=useId();
  const {data}=useQuery({queryKey:['metadata',uri],queryFn:()=>loadMetadata(uri),staleTime:3600000,gcTime:3600000,retry:false});
  const [broken,setBroken]=useState(false);
  return <div className={`artwork ${large?'artwork-large':''}`}>
    {data?.image&&!broken?<img src={data.image} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>:<><svg viewBox="0 0 600 420" aria-hidden="true" className="fallback-art"><defs><pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth=".5"/></pattern></defs><rect width="600" height="420" fill={`url(#${patternId})`}/><g fill="none" stroke="currentColor" strokeWidth="1.2">{Array.from({length:9},(_,i)=><path key={i} d={`M ${145+i*10} ${95+i*2} L ${300} ${330-i*12} L ${455-i*10} ${95+i*2} L ${300} ${185-i*8} Z`}/>)}</g></svg><span className="artwork-note">Artwork unavailable<span>ON-CHAIN ASSET · MEDIA NOT LOADED</span></span></>}
  </div>;
}
