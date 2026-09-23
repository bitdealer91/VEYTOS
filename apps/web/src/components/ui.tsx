import Link from 'next/link';
import { ArrowUpRight, CircleAlert, Layers, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatApt } from '../../../../packages/domain/src/money';
export function PriceDisplay({octas}:{octas:string}){return <span className="price">{formatApt(BigInt(octas))}<span className="currency">APT</span></span>;}
export function SectionHeader({title,subtitle,href,label='View all'}:{title:string;subtitle?:string;href?:string;label?:string}){return <div className="section-heading"><div><h2>{title}</h2>{subtitle&&<p className="muted">{subtitle}</p>}</div>{href&&<Link href={href} className="text-link">{label}<ArrowRight size={16}/></Link>}</div>;}
export function EmptyState({title,description,children}:{title:string;description:string;children?:ReactNode}){return <div className="empty"><Layers size={28} strokeWidth={1}/><h3>{title}</h3><p>{description}</p>{children}</div>;}
export function ErrorState({title='Chain data is temporarily unavailable',description='Try again shortly. We will not show outdated numbers as live data.'}:{title?:string;description?:string}){return <div role="alert" className="notice error"><CircleAlert size={20}/><div><strong>{title}</strong><p>{description}</p></div></div>;}
export function StatBlock({label,children}:{label:string;children:ReactNode}){return <div className="stat"><span>{label}</span><strong>{children}</strong></div>;}
export function SkeletonCard(){return <div className="skeleton-card" aria-label="Loading collection"><div className="skeleton media"/><div className="skeleton line"/><div className="skeleton line short"/></div>;}
export function ExternalLink({href,children}:{href:string;children:ReactNode}){return <a href={href} target="_blank" rel="noreferrer" className="text-link">{children}<ArrowUpRight size={14}/></a>;}
