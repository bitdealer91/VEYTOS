import { discovery } from '@/lib/data';
import { Explore } from '@/features/explore';
import {ErrorState} from '@/components/ui';
export const dynamic='force-dynamic';
export const metadata={title:'Explore'};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){const [data,params]=await Promise.all([discovery(),searchParams]);return <><div className="page-title"><span className="eyebrow">THE APTOS COLLECTION</span><h1>Explore</h1><p>Find what speaks to you.</p></div>{data.errors>0&&<ErrorState/>}<Explore drops={data.drops} initialQuery={params.q||''}/></>;}
