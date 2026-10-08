import type { NormalizedNFT } from '@veytos/aptos/discovery';

export type MarketplaceSessionListing = {
  assetKey: string;
  collectionKey: string;
  listingId: string;
  seller: string;
  price: string;
  listedVersion: string;
  nft: Pick<NormalizedNFT, 'standard' | 'tokenId' | 'collectionId' | 'name' | 'metadataUri' | 'collectionName'>;
};

export type MarketplaceSessionTerminal = {
  assetKey: string;
  collectionKey: string;
  transactionVersion: string;
  owner: string;
  status: 'SOLD' | 'CANCELLED';
};

export const MARKETPLACE_SESSION_EVENT = 'veytos:marketplace-session';

function storageKey(network: string, moduleAddress: string) {
  return `veytos:marketplace-snapshots:${network}:${moduleAddress}`;
}

function terminalStorageKey(network: string, moduleAddress: string) {
  return `veytos:marketplace-terminals:${network}:${moduleAddress}`;
}

function valid(value: unknown): value is MarketplaceSessionListing {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['assetKey', 'collectionKey', 'listingId', 'seller', 'price', 'listedVersion'].every((key) => typeof row[key] === 'string') &&
    !!row.nft && typeof row.nft === 'object';
}

function validTerminal(value: unknown): value is MarketplaceSessionTerminal {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['assetKey', 'collectionKey', 'transactionVersion', 'owner', 'status'].every((key) => typeof row[key] === 'string') &&
    /^\d+$/.test(String(row.transactionVersion)) && (row.status === 'SOLD' || row.status === 'CANCELLED');
}

export function readMarketplaceSession(network: string, moduleAddress: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(network, moduleAddress)) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, 50) : [];
  } catch { return []; }
}

export function readMarketplaceTerminals(network: string, moduleAddress: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(terminalStorageKey(network, moduleAddress)) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(validTerminal).slice(0, 50) : [];
  } catch { return []; }
}

export function writeMarketplaceSession(network: string, moduleAddress: string, listing: MarketplaceSessionListing | null, assetKey: string) {
  try {
    const current = readMarketplaceSession(network, moduleAddress).filter((item) => item.assetKey !== assetKey);
    if (listing) current.unshift(listing);
    localStorage.setItem(storageKey(network, moduleAddress), JSON.stringify(current.slice(0, 50)));
    if (listing) {
      const terminals = readMarketplaceTerminals(network, moduleAddress).filter((item) => item.assetKey !== assetKey);
      localStorage.setItem(terminalStorageKey(network, moduleAddress), JSON.stringify(terminals));
    }
    window.dispatchEvent(new CustomEvent(MARKETPLACE_SESSION_EVENT));
  } catch { /* Session projection is optional; chain reconciliation remains authoritative. */ }
}

export function writeMarketplaceTerminal(network: string, moduleAddress: string, terminal: MarketplaceSessionTerminal) {
  try {
    const listings = readMarketplaceSession(network, moduleAddress).filter((item) => item.assetKey !== terminal.assetKey);
    const terminals = readMarketplaceTerminals(network, moduleAddress).filter((item) => item.assetKey !== terminal.assetKey);
    terminals.unshift(terminal);
    localStorage.setItem(storageKey(network, moduleAddress), JSON.stringify(listings));
    localStorage.setItem(terminalStorageKey(network, moduleAddress), JSON.stringify(terminals.slice(0, 50)));
    window.dispatchEvent(new CustomEvent(MARKETPLACE_SESSION_EVENT));
  } catch { /* Session projection is optional; chain reconciliation remains authoritative. */ }
}
