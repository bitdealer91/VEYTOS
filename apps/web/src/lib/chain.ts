import { makeAptos, launchpad } from '@veytos/aptos/client';
import { network, packageAddress } from './config';
export const aptos = makeAptos(network);
export function chain() { if (!packageAddress) throw new Error('Launchpad is not configured'); return launchpad(aptos,packageAddress); }
