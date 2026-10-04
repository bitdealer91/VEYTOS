'use client';
import {useTransition} from 'react';
import {useRouter} from 'next/navigation';

export function RetryLaunchpad(){const router=useRouter();const[pending,startTransition]=useTransition();return <button className="button" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Checking Aptos…':'Try again'}</button>;}
