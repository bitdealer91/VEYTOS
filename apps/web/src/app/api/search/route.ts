import { marketplaceCollections } from '@/lib/marketplace-data';
import { discovery } from '@/lib/data';
import { searchLaunchpadDrops, searchMarketplaceCollections } from '@/lib/marketplace-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (query.length < 2) return Response.json({ launchpad: [], marketplace: [] });

  const [launchpad, marketplace] = await Promise.all([
    discovery(),
    marketplaceCollections({ sort: 'active', limit: 100 }),
  ]);
  return Response.json({
    launchpad: searchLaunchpadDrops(launchpad.drops, query, BigInt(Math.floor(Date.now() / 1000))),
    marketplace: searchMarketplaceCollections(marketplace.items, query),
    partial: launchpad.errors > 0 || marketplace.failed || marketplace.metadataFailed,
  }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
}
