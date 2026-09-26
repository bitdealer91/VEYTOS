import { readPublicConfig } from '@mintos/config';
export const config = readPublicConfig({
  NEXT_PUBLIC_APTOS_NETWORK: process.env.NEXT_PUBLIC_APTOS_NETWORK,
  NEXT_PUBLIC_LAUNCHPAD_ADDRESS: process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS,
  NEXT_PUBLIC_MARKETPLACE_ADDRESS: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
  NEXT_PUBLIC_ARWEAVE_GATEWAY: process.env.NEXT_PUBLIC_ARWEAVE_GATEWAY,
  NEXT_PUBLIC_APTOS_FULLNODE_URL: process.env.NEXT_PUBLIC_APTOS_FULLNODE_URL,
  NEXT_PUBLIC_APTOS_INDEXER_URL: process.env.NEXT_PUBLIC_APTOS_INDEXER_URL,
  NEXT_PUBLIC_FEEDBACK_URL: process.env.NEXT_PUBLIC_FEEDBACK_URL,
});
export const network = config.NEXT_PUBLIC_APTOS_NETWORK;
export const packageAddress = config.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;
export const marketplaceAddress = config.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
export const browserFullnodeUrl = config.NEXT_PUBLIC_APTOS_FULLNODE_URL;
export const feedbackUrl = config.NEXT_PUBLIC_FEEDBACK_URL;
export function explorer(kind: 'account'|'txn'|'object', value: string) { return `https://explorer.aptoslabs.com/${kind}/${encodeURIComponent(value)}?network=${network}`; }
