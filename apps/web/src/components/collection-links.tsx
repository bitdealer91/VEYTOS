'use client';
import {useQuery} from '@tanstack/react-query';
import {Globe} from 'lucide-react';
import {loadMetadata} from '@/lib/metadata';
import {reportClientError} from '@/lib/observability';

export function CollectionLinks({uri,links={}}:{uri:string;links?:Record<string,string>}){
  const {data}=useQuery({queryKey:['metadata',uri],queryFn:async()=>{try{return await loadMetadata(uri);}catch(error){reportClientError(error,'metadata');throw error;}},enabled:!!uri,staleTime:3_600_000,gcTime:3_600_000,retry:false});
  const projectLinks=[(links.website||data?.website)&&{href:links.website||data!.website!,label:'Website',icon:<Globe size={15}/>},(links.x||data?.x)&&{href:links.x||data!.x!,label:'X'},(links.discord||data?.discord)&&{href:links.discord||data!.discord!,label:'Discord'}].filter(Boolean) as {href:string;label:string;icon?:React.ReactNode}[];
  if(!projectLinks.length)return null;
  return <nav className="collection-links" aria-label="Project links">{projectLinks.map(link=><a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.icon}{link.label}<span aria-hidden="true">↗</span></a>)}</nav>;
}
