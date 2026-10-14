import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import './globals.css';
import { brand } from '@veytos/config';
import { Providers } from '@/components/providers';
import { AppHeader } from '@/components/header';
import { network } from '@/lib/config';
import { BetaAnalytics } from '@/components/beta-analytics';
import { SiteFooter } from '@/components/footer';
export const metadata:Metadata={title:{default:brand.metadata.title,template:`%s | ${brand.name}`},description:brand.metadata.description};
export default function RootLayout({children,modal}:{children:React.ReactNode;modal:React.ReactNode}){return <html lang="en"><body><Providers><a className="skip-link" href="#main">Skip to content</a><div className="beta-banner" role="status"><strong>Aptos {network==='mainnet'?'Mainnet':'Testnet'}</strong><span className="beta-detail">{network==='mainnet'?'The home of Aptos NFTs.':'Explore the VEYTOS launchpad and marketplace with test assets.'}</span><span className="beta-detail-mobile">{network==='mainnet'?'The home of Aptos NFTs.':'Explore with test assets.'}</span><Link href="/about">About VEYTOS</Link></div><AppHeader/><main id="main" className="container">{children}</main><SiteFooter/>{modal}<BetaAnalytics/></Providers></body></html>;}
