import { z } from 'zod';
import type { TransactionPhase } from './types.ts';
const address=z.string().regex(/^0x[\da-f]{1,64}$/i);
export const pendingMintSchema=z.object({hash:z.union([z.literal(''),z.string().regex(/^0x[\da-f]{64}$/i)]),sender:address,drop:address,quantity:z.number().int().min(1).max(20),unitPrice:z.string().regex(/^\d+$/).refine(v=>BigInt(v)<2n**64n),network:z.enum(['testnet','mainnet','devnet']),module:address});
export type MintSignal='request'|'hash'|'confirm'|'committed'|'aborted'|'timeout'|'rejected'|'interrupted'|'acknowledged-no-submission'|'reset';
/** A known hash is never discarded due to a timeout, rejection message or navigation. */
export function transactionTransition(phase:TransactionPhase,signal:MintSignal,hasHash:boolean):TransactionPhase {
 if(signal==='committed')return hasHash?'success':'unknown';
 if(signal==='aborted')return hasHash?'failure':'unknown';
 if(signal==='timeout'||signal==='interrupted')return 'unknown';
 if(signal==='rejected')return hasHash?'unknown':'failure';
 if(signal==='acknowledged-no-submission')return hasHash?'unknown':'ready';
 if(signal==='reset')return ['success','failure','ready','review'].includes(phase)?'ready':phase;
 if(signal==='hash')return hasHash?'submitted':'unknown';
 if(signal==='confirm')return hasHash?'confirming':'unknown';
 if(signal==='request')return ['ready','review','failure'].includes(phase)&&!hasHash?'wallet':phase;
 return phase;
}
export function definitiveRejection(error:unknown) {
 const code=typeof error==='object'&&error!==null&&'code' in error?error.code:undefined;
 return code===4001||/user rejected|user denied|rejected by user|request rejected|user cancelled|user canceled/i.test(String(error));
}
