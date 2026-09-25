import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import './globals.css';
import { brand } from '@mintos/config';
import { Providers } from '@/components/providers';
import { AppHeader } from '@/components/header';
import { network } from '@/lib/config';
export const metadata:Metadata={title:{default:brand.metadata.title,template:`%s | ${brand.name}`},description:brand.metadata.description};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers><a className="skip-link" href="#main">Skip to content</a><AppHeader/><main id="main" className="container">{children}</main><footer className="container footer"><div><Link href="/" className="wordmark">{brand.name}</Link><span>{brand.tagline}</span></div><p>Aptos native <span>·</span> {network==='mainnet'?'Mainnet':'Test assets. No financial value.'}</p><Link href="/explore">Explore collections ↗</Link></footer></Providers></body></html>;}
