import {ErrorState} from '@/components/ui';
import {Explore} from '@/features/explore';
import {discovery} from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Drops'};

export default async function Page() {
  const data = await discovery();

  return <section className="launch-catalog">
    <header className="launch-page-head">
      <span className="eyebrow">APTOS-NATIVE DROPS</span>
      <h1>Launchpad</h1>
      <p>Explore live, upcoming, and completed NFT drops on Aptos.</p>
    </header>
    {data.errors > 0 && <ErrorState title="Some drops could not be refreshed" description="Available cards use fresh Aptos state. Unavailable drops are not shown as live."/>}
    <Explore drops={data.drops}/>
  </section>;
}
