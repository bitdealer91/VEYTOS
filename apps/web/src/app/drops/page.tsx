import {discovery} from '@/lib/data';import {Explore} from '@/features/explore';import {ErrorState} from '@/components/ui';
export const dynamic='force-dynamic';export const metadata={title:'Drops'};
export default async function Page(){const d=await discovery();return <><div className="page-title"><span className="eyebrow">FROM CREATORS TO COLLECTORS</span><h1>The launchpad</h1><p>New collections. First editions. Your next find.</p></div>{d.errors>0&&<ErrorState/>}<Explore drops={d.drops}/></>;}
