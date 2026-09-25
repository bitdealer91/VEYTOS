import { Aptos, AptosConfig, Network, type UserTransactionResponse } from '@aptos-labs/ts-sdk';
import { z } from 'zod';
import { canonical } from './domain.ts';
import type { Asset, Drop, MintEvent, PendingMint } from './types.ts';
const u64 = z.string().regex(/^\d+$/).refine(v => BigInt(v) <= (1n << 64n) - 1n);
const addr = z.string().transform(canonical);
const dropSchema = z.object({ collection: addr, finalized: z.boolean(), creator_paused: z.boolean(), admin_paused: z.boolean(), uploaded: u64, minted: u64,
  terms: z.object({ creator: addr, name: z.string(), description: z.string(), collection_uri: z.string(), max_supply: u64, unit_price: u64, wallet_limit: u64, transaction_limit: u64, start_seconds: u64, end_seconds: u64, royalty_bps: u64, fee_bps: u64 }) });
export type AptosEndpointOptions = { fullnode?: string; apiKey?: string };
export function makeAptos(network: 'testnet'|'mainnet'|'devnet', endpoint: AptosEndpointOptions = {}) {
  return new Aptos(new AptosConfig({
    network: { testnet: Network.TESTNET, mainnet: Network.MAINNET, devnet: Network.DEVNET }[network],
    ...(endpoint.fullnode ? { fullnode: endpoint.fullnode } : {}),
    ...(endpoint.apiKey ? { fullnodeConfig: { HEADERS: { Authorization: `Bearer ${endpoint.apiKey}` } } } : {}),
  }));
}
export function launchpad(aptos: Aptos, packageAddress: string) {
  const module = canonical(packageAddress);
  const fn = (name: string) => `${module}::launchpad::${name}` as const;
  async function drop(address: string): Promise<Drop> {
    const [value] = await aptos.view({ payload: { function: fn('get_drop'), functionArguments: [canonical(address)] } });
    return { ...dropSchema.parse(value), address: canonical(address) };
  }
  async function eligibility(address: string, buyer?: string) {
    const [data, ledger, policy, counts] = await Promise.all([
      drop(address), aptos.getLedgerInfo(),
      aptos.view<[string,string,boolean,string]>({ payload: { function: `${module}::fee_policy::configuration`, functionArguments: [] } }),
      buyer ? aptos.view<[string]>({ payload: { function: fn('minted_by'), functionArguments: [address, canonical(buyer)] } }) : Promise.resolve(['0']),
    ]);
    return { drop: data, now: (BigInt(ledger.ledger_timestamp)/1000000n).toString(), chainId: ledger.chain_id, paused: policy[2], walletMinted: counts[0]! };
  }
  function mintPayload(address: string, quantity: number, unitPrice: string) {
    return { function: fn('mint'), functionArguments: [canonical(address), String(quantity), unitPrice, (BigInt(unitPrice)*BigInt(quantity)).toString()] };
  }
  async function asset(address: string, version?: bigint): Promise<Asset> {
    const options = version === undefined ? {} : { ledgerVersion: version };
    const [token, object, names] = await Promise.all([
      aptos.getAccountResource<{ name: string; uri: string; collection: { inner: string } }>({ accountAddress: canonical(address), resourceType: '0x4::token::Token', options }),
      aptos.getAccountResource<{ owner: string }>({ accountAddress: canonical(address), resourceType: '0x1::object::ObjectCore', options }),
      aptos.view<[string]>({payload:{function:'0x4::token::name',typeArguments:['0x4::token::Token'],functionArguments:[canonical(address)]},options}),
    ]);
    return { identity: {standard:'v2', address: canonical(address)}, address: canonical(address), name: names[0], uri: token.uri, owner: canonical(object.owner), collection: canonical(token.collection.inner) };
  }
  async function items(data: Drop, offset = 0) {
    const count = Math.min(12, Math.max(0, Number(data.minted) - offset));
    return Promise.all(Array.from({length:count}, async (_, i) => {
      const [token] = await aptos.view<[string]>({ payload: { function: fn('token_address'), functionArguments: [data.address, String(offset+i+1)] } });
      return asset(token);
    }));
  }
  function events(tx: UserTransactionResponse) {
    return tx.events.filter(e => e.type === `${module}::launchpad::NFTMinted`).map(e => e.data as MintEvent);
  }
  async function reconcile(pending: PendingMint) {
    const receipt = await aptos.getTransactionByHash({transactionHash: pending.hash});
    if (receipt.type === 'pending_transaction') return { status: 'pending' as const };
    if (receipt.type !== 'user_transaction') throw new Error('Unexpected receipt');
    const tx = receipt as UserTransactionResponse;
    validateMintReceipt(tx, pending, module);
    if (!tx.success) return {status:'failed' as const, message:tx.vm_status};
    const minted = events(tx);
    const data = await drop(pending.drop);
    if (minted.length !== pending.quantity) throw new Error('Mint events do not match');
    const assets = await Promise.all(minted.map(async e => {
      if (canonical(e.buyer) !== canonical(pending.sender) || canonical(e.drop) !== canonical(pending.drop) || canonical(e.collection) !== canonical(data.collection)) throw new Error('Mint event mismatch');
      const nft = await asset(e.token,BigInt(tx.version));
      if (nft.owner !== canonical(pending.sender) || nft.collection !== canonical(data.collection)) throw new Error('Ownership mismatch');
      return nft;
    }));
    return {status:'success' as const, assets, receipt:tx};
  }
  return { drop, eligibility, mintPayload, asset, items, reconcile, events };
}
export function validateMintReceipt(tx: UserTransactionResponse, pending: PendingMint, module: string) {
  const payload = tx.payload as { function?: string; arguments?: unknown[] };
  if (tx.hash !== pending.hash || canonical(tx.sender) !== canonical(pending.sender) || canonical(pending.module) !== canonical(module) || payload.function !== `${canonical(module)}::launchpad::mint`) throw new Error('Transaction identity mismatch');
  const a = payload.arguments;
  if (!a || canonical(String(a[0])) !== canonical(pending.drop) || String(a[1]) !== String(pending.quantity) || String(a[2]) !== pending.unitPrice || String(a[3]) !== String(BigInt(pending.unitPrice)*BigInt(pending.quantity))) throw new Error('Transaction terms mismatch');
}
