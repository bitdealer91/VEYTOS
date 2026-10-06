import { homedir } from 'node:os';
import { resolve } from 'node:path';

process.env.VEYTOS_DROP_COLLECTION = 'RONGS';
process.env.VEYTOS_DROP_SPECIES = 'Binturong';
process.env.VEYTOS_DROP_DESCRIPTION = 'RONGS is a collection of 187 unique Binturong NFTs on Aptos testnet.';
process.env.VEYTOS_DROP_ID = 'rongs-187-v1';
process.env.VEYTOS_DROP_OUTPUT_DIR = '.testnet/rongs';
process.env.VEYTOS_DROP_SOURCE_IMAGE_JOURNAL = '.testnet/originals/journal.json';
process.env.VEYTOS_DROP_COVER_IMAGE ||= resolve(homedir(), 'Desktop/Picsart_26-10-01_11-52-14-085 (1).gif');

await import('./originals-testnet-drop.ts');
