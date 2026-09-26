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
import { network,feedbackUrl } from '@/lib/config';
import { BetaAnalytics } from '@/components/beta-analytics';
export const metadata:Metadata={title:{default:brand.metadata.title,template:`%s | ${brand.name}`},description:brand.metadata.description};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers><a className="skip-link" href="#main">Skip to content</a><div className="beta-banner" role="status"><strong>Aptos {network==='mainnet'?'Mainnet':'Testnet Beta'}</strong><span>{network==='mainnet'?'External security review required before public trading.':'Test assets only · No real-value trading · Contracts are not externally audited.'}</span><Link href="/about">Beta details</Link></div><AppHeader/><main id="main" className="container">{children}</main><footer className="container footer"><div><Link href="/" className="wordmark">{brand.name}</Link><span>{brand.tagline}</span></div><p>Aptos native <span>·</span> {network==='mainnet'?'Mainnet':'Test assets. No financial value.'}</p><div className="footer-links"><Link href="/about">About & fees</Link>{feedbackUrl&&<a href={feedbackUrl} target="_blank" rel="noreferrer">Report an issue ↗</a>}<Link href="/explore">Explore ↗</Link></div></footer><BetaAnalytics/></Providers></body></html>;}
