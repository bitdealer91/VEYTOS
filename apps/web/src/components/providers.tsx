'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Network } from '@aptos-labs/ts-sdk';
import { network } from '@/lib/config';
import { readableError } from '@veytos/aptos/domain';
import { reportClientError } from '@/lib/observability';
import {TransactionToastProvider} from './transaction-toasts';
const WalletError=createContext({message:'',clear:()=>{}});
export const useWalletError=()=>useContext(WalletError);
export function Providers({children}:{children:ReactNode}) {
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:15000,retry:1,refetchOnWindowFocus:false}}}));
  const [message,setMessage]=useState('');
  return <QueryClientProvider client={client}><TransactionToastProvider><WalletError.Provider value={{message,clear:()=>setMessage('')}}><AptosWalletAdapterProvider autoConnect disableTelemetry dappConfig={{network:network as Network}} onError={e=>{setMessage(readableError(e));reportClientError(e,'wallet_adapter');}}>{children}</AptosWalletAdapterProvider></WalletError.Provider></TransactionToastProvider></QueryClientProvider>;
}
