'use client';
import Link from 'next/link';
import { ArrowUpRight, Tag } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { canonical } from '@veytos/aptos/domain';

export function ProfileNFTAction({ profileAddress, href }: { profileAddress: string; href: string }) {
  const wallet = useWallet();
  const isOwner = !!wallet.account && canonical(wallet.account.address.toString()) === canonical(profileAddress);
  return <Link className={isOwner ? 'profile-card-action owner' : 'profile-card-action'} href={isOwner ? `${href}?action=list` : href}>
    {isOwner ? <><Tag size={13} /> List NFT</> : <>View NFT <ArrowUpRight size={13} /></>}
  </Link>;
}
