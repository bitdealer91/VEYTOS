'use client';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Link from 'next/link';
import { WalletButton } from '@/components/wallet';
export default function MyProfile(){const wallet=useWallet();const address=wallet.account?.address.toString();return <section><div className="page-title"><span className="eyebrow">YOUR APTOS COLLECTION</span><h1>Profile</h1><p>Owned NFTs, active listings, and verified marketplace activity.</p></div>{address?<div className="empty"><h3>Wallet ready</h3><p>Open the profile for your connected Aptos account.</p><Link className="button primary" href={`/profile/${address}`}>View my NFTs</Link></div>:<div className="empty"><h3>Connect your wallet</h3><p>VEYTOS needs only your public account address to load this profile.</p><WalletButton label="Connect wallet"/></div>}</section>}
