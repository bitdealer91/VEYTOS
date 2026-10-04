import { NFTRouteModal } from '@/components/nft-route-modal';
import { NFTDetail } from '@/features/nft-detail';

export const dynamic = 'force-dynamic';

export default async function NFTModalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ action?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return <NFTRouteModal><NFTDetail token={token} initialAction={query.action === 'list' ? 'list' : undefined} modal /></NFTRouteModal>;
}
