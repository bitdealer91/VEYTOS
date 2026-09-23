'use client';
import { useId, useRef, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Wallet, X, ArrowUpRight, LogOut } from 'lucide-react';
import { explorer } from '@/lib/config';
import { useWalletError } from './providers';
import { readableError } from '@veytos/aptos/domain';
import { brand } from '@mintos/config';
export function WalletButton({label='Connect wallet'}:{label?:string}) {
  const titleId=useId();const wallet=useWallet(); const dialog=useRef<HTMLDialogElement>(null);const [busy,setBusy]=useState('');const [error,setError]=useState('');const providerError=useWalletError();
  async function connect(name:Parameters<typeof wallet.connect>[0]){setError('');providerError.clear();setBusy(String(name));try{await wallet.connect(name);}catch(e){setError(readableError(e));}finally{setBusy('');}}
  return <><button className="button wallet-button" onClick={()=>dialog.current?.showModal()}><Wallet size={16}/><span>{wallet.connected&&wallet.account?`${wallet.account.address.toString().slice(0,6)}…${wallet.account.address.toString().slice(-4)}`:label}</span></button>
    <dialog ref={dialog} className="dialog" aria-labelledby={titleId}><div className="dialog-head"><span className="eyebrow">{brand.name} · APTOS</span><button className="icon-button" aria-label="Close wallet dialog" onClick={()=>dialog.current?.close()}><X size={20}/></button></div><h2 id={titleId}>{wallet.connected?'Your wallet':'A collection starts with a connection.'}</h2><p className="muted">{wallet.connected?'You control your assets. Connecting does not create an authenticated account.':'Choose an Aptos wallet. Your keys stay with you.'}</p>
    {wallet.connected?<div className="stack"><a className="button primary" target="_blank" rel="noreferrer" href={explorer('account',wallet.account!.address.toString())}>View account on Aptos <ArrowUpRight size={16}/></a><button className="button" onClick={async()=>{await wallet.disconnect();dialog.current?.close();}}><LogOut size={16}/>Disconnect</button></div>:<div className="stack">{wallet.wallets.map(w=><button key={w.name} className="wallet-option" disabled={!!busy} onClick={()=>connect(w.name)}><span>{w.name}</span><span>{busy===w.name?'Connecting…':<ArrowUpRight size={18}/>}</span></button>)}{!wallet.wallets.length&&<p>Looking for compatible wallets…</p>}<a className="wallet-option" href="https://petra.app" target="_blank" rel="noreferrer"><span>Get Petra <small>Browser extension & mobile</small></span><ArrowUpRight size={18}/></a></div>}
    {(error||providerError.message)&&<p className="notice error" role="alert">{error||providerError.message}</p>}
    {wallet.connected&&<p className="notice success" role="status">Wallet connected. You can close this panel.</p>}<p className="caption muted">Only approve transactions you understand. {brand.name} will never ask for your recovery phrase.</p></dialog></>;
}
