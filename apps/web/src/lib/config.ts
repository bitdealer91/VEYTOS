import { readPublicConfig } from '@mintos/config';
export const config = readPublicConfig({
  NEXT_PUBLIC_APTOS_NETWORK: process.env.NEXT_PUBLIC_APTOS_NETWORK,
  NEXT_PUBLIC_LAUNCHPAD_ADDRESS: process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
});
export const network = config.NEXT_PUBLIC_APTOS_NETWORK;
export const packageAddress = config.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;
export function explorer(kind: 'account'|'txn'|'object', value: string) { return `https://explorer.aptoslabs.com/${kind}/${encodeURIComponent(value)}?network=${network}`; }
