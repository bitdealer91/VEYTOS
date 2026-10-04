'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export function NFTRouteModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') router.back(); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [router]);
  return <div className="nft-route-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) router.back(); }}>
    <div className="nft-route-modal" role="dialog" aria-modal="true" aria-label="NFT details">
      <div className="nft-route-modal-bar"><span>VEYTOS · NFT DETAILS</span><button className="icon-button" aria-label="Close NFT details" onClick={() => router.back()}><X size={20} /></button></div>
      <div className="nft-route-modal-scroll">{children}</div>
    </div>
  </div>;
}
