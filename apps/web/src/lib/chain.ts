import { makeAptos, launchpad } from '@veytos/aptos/client';
import { marketplace } from '@veytos/aptos/marketplace';
import { network, packageAddress, marketplaceAddress } from './config';
export const aptos = makeAptos(network);
export function chain() { if (!packageAddress) throw new Error('Launchpad is not configured'); return launchpad(aptos,packageAddress); }
export function marketChain() { if (!marketplaceAddress) throw new Error('Marketplace is not configured'); return marketplace(aptos,marketplaceAddress); }
