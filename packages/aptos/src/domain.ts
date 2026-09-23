import { AccountAddress } from '@aptos-labs/ts-sdk';
import { quoteMint } from '../../domain/src/money.js';
import type { Drop, TransactionPhase } from './types.js';
export const canonical = (address: string) => AccountAddress.from(address).toStringLong();
export function dropStatus(drop: Drop, now: bigint) {
  if (BigInt(drop.minted) >= BigInt(drop.terms.max_supply)) return 'SOLD OUT';
  if (BigInt(drop.terms.end_seconds) > 0n && now >= BigInt(drop.terms.end_seconds)) return 'ENDED';
  if (!drop.finalized || now < BigInt(drop.terms.start_seconds)) return 'UPCOMING';
  return 'LIVE';
}
export function countdown(target: bigint, now: bigint) {
  const diff = target > now ? target - now : 0n;
  if (!diff) return 'Now';
  const days = diff / 86400n, hours = diff % 86400n / 3600n, minutes = diff % 3600n / 60n;
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m ${diff % 60n}s`;
}
export function networkMatches(expected: number, walletChainId: number | string | undefined) {
  return walletChainId !== undefined && Number(walletChainId) === expected;
}
export function validateQuantity(drop: Drop, quantity: number, walletMinted: bigint) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Choose at least one NFT.');
  const q = BigInt(quantity);
  if (q > BigInt(drop.terms.transaction_limit)) throw new Error('Quantity exceeds the transaction limit.');
  if (q > BigInt(drop.terms.max_supply) - BigInt(drop.minted)) throw new Error('Not enough NFTs remain.');
  if (q + walletMinted > BigInt(drop.terms.wallet_limit)) throw new Error('Wallet mint limit reached.');
  return quoteMint(BigInt(drop.terms.unit_price), q, BigInt(drop.terms.fee_bps));
}
export function isUnresolved(phase: TransactionPhase) { return ['wallet','submitted','confirming','unknown'].includes(phase); }
export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|4001|cancel/i.test(message)) return 'Request cancelled in your wallet. Nothing new was confirmed.';
  if (/INSUFFICIENT|balance.*gas/i.test(message)) return 'Not enough APT. Leave room for the mint price and network fees.';
  if (/ESUPPLY|sold.out/i.test(message)) return 'This quantity is no longer available. Refresh the collection.';
  if (/EWALLET_LIMIT|wallet mint limit/i.test(message)) return 'You have reached this collection’s wallet mint limit.';
  if (/ENOT_STARTED/i.test(message)) return 'Minting has not started yet.';
  if (/EENDED/i.test(message)) return 'This mint has ended.';
  if (/EPAUSED/i.test(message)) return 'Minting is temporarily paused.';
  if (/network|chain.*mismatch/i.test(message)) return 'Switch your wallet to the network shown in the header.';
  if (/EPRICE_CHANGED|EMAX_TOTAL/i.test(message)) return 'The transaction did not match your reviewed price. Review again.';
  return 'We could not complete this request. Check your connection and try again.';
}
