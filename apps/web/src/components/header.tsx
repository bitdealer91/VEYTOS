'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search,ArrowUpRight } from 'lucide-react';
import { brand } from '@mintos/config';
import { WalletButton } from './wallet';
import {network} from '@/lib/config';
export function SearchBar(){return <form action="/explore" className="search"><Search size={17}/><input name="q" aria-label="Search collections" placeholder="Search collections" autoComplete="off"/><kbd>/</kbd></form>;}
export function AppHeader(){const path=usePathname();return <header className="app-header"><div className="header-inner"><Link href="/" className="wordmark" aria-label={`${brand.name} home`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4h6l4 10 4-10h6L12 24z" fill="currentColor"/><path d="M10 4h4l-2 5z" fill="currentColor"/></svg>{brand.name}</Link><nav aria-label="Main navigation">{[['/explore','Explore'],['/drops','Drops'],['/activity','Activity'],['/studio','Launch']].map(([href,name])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{name}{name==='Launch'&&<ArrowUpRight size={12}/>}</Link>)}</nav><SearchBar/><div className="header-actions"><span className="network-badge"><i/>{network.toUpperCase()}</span><WalletButton/></div></div></header>;}
