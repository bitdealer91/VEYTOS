'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {AlertTriangle,ArrowUpRight,CheckCircle2,Clock3,LoaderCircle,X} from 'lucide-react';

export type TransactionToastTone='pending'|'success'|'error'|'unknown';
export type TransactionToastInput={id:string;title:string;message:string;tone:TransactionToastTone;href?:string;duration?:number};
type TransactionToast=TransactionToastInput&{revision:number};
type ToastApi={show:(toast:TransactionToastInput)=>void;dismiss:(id:string)=>void};
const ToastContext=createContext<ToastApi|null>(null);

export function TransactionToastProvider({children}:{children:ReactNode}){
  const[toasts,setToasts]=useState<TransactionToast[]>([]);
  const dismiss=useCallback((id:string)=>setToasts(current=>current.filter(toast=>toast.id!==id)),[]);
  const show=useCallback((input:TransactionToastInput)=>setToasts(current=>{
    const next={...input,revision:Date.now()};const existing=current.findIndex(toast=>toast.id===input.id);
    if(existing<0)return [...current.slice(-2),next];
    return current.map((toast,index)=>index===existing?next:toast);
  }),[]);
  const api=useMemo(()=>({show,dismiss}),[show,dismiss]);
  return <ToastContext.Provider value={api}>{children}<section className="toast-viewport" aria-label="Transaction notifications">{toasts.map(toast=><TransactionToastCard key={toast.id} toast={toast} dismiss={dismiss}/>)}</section></ToastContext.Provider>;
}

export function useTransactionToast(){const value=useContext(ToastContext);if(!value)throw new Error('TransactionToastProvider is missing');return value;}

function TransactionToastCard({toast,dismiss}:{toast:TransactionToast;dismiss:(id:string)=>void}){
  useEffect(()=>{const duration=toast.duration??(toast.tone==='success'?9000:toast.tone==='error'?12000:0);if(!duration)return;const timer=window.setTimeout(()=>dismiss(toast.id),duration);return()=>window.clearTimeout(timer);},[dismiss,toast]);
  const Icon=toast.tone==='success'?CheckCircle2:toast.tone==='error'?AlertTriangle:toast.tone==='unknown'?Clock3:LoaderCircle;
  return <article className={`transaction-toast ${toast.tone}`} role={toast.tone==='error'?'alert':'status'} aria-live={toast.tone==='error'?'assertive':'polite'}>
    <div className="toast-accent"/><div className="toast-icon"><Icon size={19}/></div><div className="toast-copy"><span className="eyebrow">APTOS TRANSACTION</span><strong>{toast.title}</strong><p>{toast.message}</p>{toast.href&&<a href={toast.href} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={13}/></a>}</div><button className="toast-close" aria-label="Dismiss notification" onClick={()=>dismiss(toast.id)}><X size={16}/></button>
  </article>;
}
