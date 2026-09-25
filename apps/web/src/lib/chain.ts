import { makeAptos, launchpad } from '@veytos/aptos/client';
import { marketplace } from '@veytos/aptos/marketplace';
import { browserFullnodeUrl, network, packageAddress, marketplaceAddress } from './config';
const server = typeof window === 'undefined';
const fullnode = server ? process.env.APTOS_FULLNODE_URL || browserFullnodeUrl : browserFullnodeUrl;
const apiKey = server ? process.env.APTOS_API_KEY : undefined;
export const aptos = makeAptos(network, { ...(fullnode ? { fullnode } : {}), ...(apiKey ? { apiKey } : {}) });
const launchpadClient = packageAddress ? launchpad(aptos, packageAddress) : null;
const marketplaceClient = marketplaceAddress ? marketplace(aptos, marketplaceAddress) : null;
export function chain() { if (!launchpadClient) throw new Error('Launchpad is not configured'); return launchpadClient; }
export function marketChain() { if (!marketplaceClient) throw new Error('Marketplace is not configured'); return marketplaceClient; }
