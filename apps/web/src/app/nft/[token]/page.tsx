import { NFTDetail } from '@/features/nft-detail';

export const dynamic = 'force-dynamic';

export default async function NFTPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ action?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return <NFTDetail token={token} initialAction={query.action === 'list' ? 'list' : undefined} />;
}
