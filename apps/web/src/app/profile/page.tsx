'use client';
import { useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WalletButton } from '@/components/wallet';
export default function MyProfile(){const wallet=useWallet();const router=useRouter();const address=wallet.account?.address.toString();useEffect(()=>{if(address)router.replace(`/profile/${address}`);},[address,router]);return <section className="profile-gate"><div className="profile-gate-copy"><span className="eyebrow">YOUR VEYTOS INVENTORY</span><h1>{address?'Opening your profile…':'Connect to manage your NFTs'}</h1><p>View owned assets, create fixed-price listings, cancel active listings, and review verified marketplace activity.</p>{address?<Link className="button primary" href={`/profile/${address}`}>Continue to profile</Link>:<WalletButton label="Connect wallet"/>}</div><div className="profile-gate-steps"><span>01</span><p><strong>Choose an NFT</strong> from your current Aptos inventory.</p><span>02</span><p><strong>Set one fixed price</strong> in APT and review exact settlement economics.</p><span>03</span><p><strong>Confirm in your wallet.</strong> VEYTOS never lists an asset without your signature.</p></div></section>}
