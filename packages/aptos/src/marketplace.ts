import { AccountAddress, Aptos, Hex, Serializer, type UserTransactionResponse } from '@aptos-labs/ts-sdk';
import { z } from 'zod';
import { canonical } from './domain.ts';
import { rpcReadCoordinator, type RpcReadOptions } from './rpc-read.ts';
import type {
  MarketplaceConfig,
  MarketplaceEconomics,
  MarketplaceAssetState,
  MarketplaceListing,
  PendingMarketplaceTransaction,
  TokenIdentity,
} from './types.ts';

const u64 = z.string().regex(/^\d+$/).refine((value) => BigInt(value) < 2n ** 64n);
const status = ['ACTIVE', 'CANCELLED', 'SOLD'] as const;
const routePrefix = 'veytos-nft-';
const assetSchema = z.object({
  standard: z.union([z.literal(1), z.literal(2), z.literal('1'), z.literal('2')]),
  v1_creator: z.string(), v1_collection: z.string(), v1_token: z.string(), v1_property_version: u64,
  v2_token: z.string(), collection: z.string(),
});

export function encodeNFTIdentity(identity: TokenIdentity) {
  const value = identity.standard === 'v2'
    ? JSON.stringify(['v2', canonical(identity.address)])
    : JSON.stringify(['v1', canonical(identity.creator), identity.collection, identity.name, u64.parse(identity.propertyVersion)]);
  const bytes = new TextEncoder().encode(value);
  return `${routePrefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function decodeNFTIdentity(route: string): TokenIdentity {
  if (!route.startsWith(routePrefix)) throw new Error('Unsupported NFT route identity');
  const hex = route.slice(routePrefix.length);
  if (!hex || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) throw new Error('Malformed NFT route identity');
  const json = new TextDecoder().decode(Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16)));
  const parsed = z.union([
    z.tuple([z.literal('v2'), z.string()]),
    z.tuple([z.literal('v1'), z.string(), z.string(), z.string(), u64]),
  ]).parse(JSON.parse(json));
  return parsed[0] === 'v2'
    ? { standard: 'v2', address: canonical(parsed[1]) }
    : { standard: 'v1', creator: canonical(parsed[1]), collection: parsed[2], name: parsed[3], propertyVersion: parsed[4] };
}

export function quoteMarketplaceSale(
  price: bigint,
  feeBps: bigint,
  royaltyNumerator: bigint,
  royaltyDenominator: bigint,
  storageReimbursement: bigint,
): MarketplaceEconomics {
  if (price <= 0n || feeBps < 0n || feeBps > 500n || royaltyDenominator <= 0n ||
      royaltyNumerator < 0n || royaltyNumerator > royaltyDenominator || storageReimbursement < 0n) {
    throw new Error('Invalid marketplace economics');
  }
  const fee = price * feeBps / 10000n;
  const royalty = price * royaltyNumerator / royaltyDenominator;
  if (fee + royalty > price) throw new Error('Marketplace deductions exceed price');
  const sellerProceeds = price - fee - royalty;
  return { price, fee, royalty, sellerProceeds, storageReimbursement, buyerTotalBeforeGas: price + storageReimbursement };
}

export function marketplacePaused(config: MarketplaceConfig, standard: 'v1' | 'v2') {
  return config.globalPaused || (standard === 'v1' ? config.v1Paused : config.v2Paused);
}

export type MarketplacePreparationStage = 'configuration' | 'asset-state' | 'eligibility' | 'payload' | 'wallet' | 'reconciliation';
export function marketplaceErrorMessage(error: unknown, stage: MarketplacePreparationStage) {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|4001|user cancel/i.test(message)) return 'Request cancelled in your wallet. No transaction was submitted.';
  if (/INSUFFICIENT|insufficient.*balance|balance.*(gas|fee)/i.test(message)) return 'Your balance is too low for the price, storage reimbursement, and gas.';
  if (/EPRICE_CHANGED|EMAX_TOTAL|price changed/i.test(message)) return 'The listing price changed. Review the new price before buying.';
  if (/ELISTING_STALE|Listing unavailable|listing.*(changed|inactive|not active)/i.test(message)) return 'This listing changed or is no longer available. Refreshing…';
  if (/EPAUSED/i.test(message)) return 'Marketplace purchases are temporarily paused.';
  if (/wrong network|chain.*mismatch/i.test(message)) return 'Switch your wallet to Aptos Testnet.';
  if (/older than the confirmed transaction|ESTATE_UPDATING/i.test(message)) return 'Marketplace state is still updating. Try again in a moment.';
  if (/\b429\b|too many requests/i.test(message)) return 'Marketplace data is temporarily unavailable. No transaction was submitted.';
  if (/ECONN|ENOTFOUND|ETIMEDOUT|fetch failed|network request|502|503|504|RPC unavailable/i.test(message)) return 'We could not reach Aptos. No transaction was submitted.';
  if (stage !== 'wallet' && stage !== 'reconciliation') return "We couldn't prepare this transaction. No funds were transferred.";
  return 'The wallet did not return a transaction hash. Check wallet activity before trying again.';
}

export function marketplaceErrorDiagnostic(error: unknown, stage: MarketplacePreparationStage) {
  const value = error as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
  return {
    stage,
    name: typeof value?.name === 'string' ? value.name : 'UnknownError',
    message: typeof value?.message === 'string' ? value.message : String(error),
    code: typeof value?.code === 'string' || typeof value?.code === 'number' ? String(value.code) : null,
    status: typeof value?.status === 'string' || typeof value?.status === 'number' ? String(value.status) : null,
  };
}

export function marketplaceAssetKey(identity: TokenIdentity, collectionId?: string) {
  const serializer = new Serializer();
  serializer.serializeU8(identity.standard === 'v1' ? 1 : 2);
  AccountAddress.fromString(identity.standard === 'v1' ? canonical(identity.creator) : canonical('0x0')).serialize(serializer);
  serializer.serializeStr(identity.standard === 'v1' ? identity.collection : '');
  serializer.serializeStr(identity.standard === 'v1' ? identity.name : '');
  serializer.serializeU64(identity.standard === 'v1' ? BigInt(identity.propertyVersion) : 0n);
  AccountAddress.fromString(identity.standard === 'v2' ? canonical(identity.address) : canonical('0x0')).serialize(serializer);
  AccountAddress.fromString(identity.standard === 'v1' ? canonical(identity.creator) : canonical(collectionId || '')).serialize(serializer);
  return Hex.fromHexInput(serializer.toUint8Array()).toString();
}

export function marketplace(aptos: Aptos, packageAddress: string) {
  const module = canonical(packageAddress);
  const reads = rpcReadCoordinator(aptos);
  const marketFn = (name: string) => `${module}::marketplace::${name}` as const;
  const feeFn = (name: string) => `${module}::marketplace_fee_policy::${name}` as const;
  let activeAssetsHandle: Promise<string> | null = null;
  let cachedConfig: { value: MarketplaceConfig; expiresAt: number } | null = null;

  function stateHandle(options: RpcReadOptions = {}) {
    activeAssetsHandle ??= reads.run(`${module}:state-handle`, async () => {
      const state = await aptos.getAccountResource<{ active_assets: { handle: string } }>({
        accountAddress: module, resourceType: `${module}::marketplace::State`,
      });
      return state.active_assets.handle;
    }, options).catch((error) => { activeAssetsHandle = null; throw error; });
    return activeAssetsHandle;
  }

  async function config(options: RpcReadOptions & { fresh?: boolean } = {}): Promise<MarketplaceConfig> {
    if (!options.fresh && cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.value;
    return reads.run(`${module}:configuration`, async () => {
    const [configuration, v1Storage, v2Storage, ledger] = await Promise.all([
      aptos.view<[string, string, boolean, boolean, boolean, string]>({
        payload: { function: feeFn('configuration'), functionArguments: [] },
      }),
      aptos.view<[string]>({ payload: { function: feeFn('storage_reimbursement'), functionArguments: [1] } }),
      aptos.view<[string]>({ payload: { function: feeFn('storage_reimbursement'), functionArguments: [2] } }),
      aptos.getLedgerInfo(),
    ]);
    const value = {
      chainId: ledger.chain_id,
      feeBps: u64.parse(configuration[0]), recipient: canonical(configuration[1]),
      globalPaused: configuration[2], v1Paused: configuration[3], v2Paused: configuration[4],
      admin: canonical(configuration[5]), v1StorageReimbursement: u64.parse(v1Storage[0]),
      v2StorageReimbursement: u64.parse(v2Storage[0]),
    };
    cachedConfig = { value, expiresAt: Date.now() + 5 * 60_000 };
    return value;
    }, options);
  }

  async function pauseState(options: RpcReadOptions = {}) {
    return reads.run(`${module}:pause-state`, async () => {
      const [configuration] = await aptos.view<[string, string, boolean, boolean, boolean, string]>({
        payload: { function: feeFn('configuration'), functionArguments: [] },
      });
      return { globalPaused: configuration[2], v1Paused: configuration[3], v2Paused: configuration[4] };
    }, options);
  }

  async function listing(id: string, options: RpcReadOptions = {}): Promise<MarketplaceListing> {
    const listingId = u64.parse(id);
    return reads.run(`${module}:listing:${listingId}:r${options.retries ?? 2}`, async () => {
    const [terms, asset] = await Promise.all([
      aptos.view<[string, number, string, string, string, string, string, string, number]>({
        payload: { function: marketFn('listing_terms'), functionArguments: [listingId] },
      }),
      aptos.view<unknown[]>({ payload: { function: marketFn('listing_asset'), functionArguments: [listingId] } }),
    ]);
    const standard = Number(terms[1]) === 1 ? 'v1' : Number(terms[1]) === 2 ? 'v2' : null;
    if (!standard || !status[Number(terms[8]) - 1]) throw new Error('Unsupported listing state');
    const parsedAsset = assetSchema.parse(asset[0]);
    let identity: TokenIdentity;
    let collectionId: string;
    if (standard === 'v1') {
      identity = { standard: 'v1', creator: canonical(parsedAsset.v1_creator), collection: parsedAsset.v1_collection, name: parsedAsset.v1_token, propertyVersion: parsedAsset.v1_property_version };
      collectionId = canonical(parsedAsset.v1_creator);
    } else {
      identity = { standard: 'v2', address: canonical(parsedAsset.v2_token) };
      collectionId = canonical(parsedAsset.collection);
    }
    const listingStatus = status[Number(terms[8]) - 1]!;
    let escrowAddress: string | null = null;
    if (listingStatus === 'ACTIVE' && standard === 'v2') {
      const [address] = await aptos.view<[string]>({ payload: { function: `${module}::settlement_v2::escrow_address`, functionArguments: [listingId] } });
      escrowAddress = canonical(address);
    }
    return {
      id: listingId, seller: canonical(terms[0]), standard, identity, collectionId,
      price: u64.parse(terms[2]), feeBps: u64.parse(terms[3]), storageReimbursement: u64.parse(terms[4]),
      royaltyPayee: canonical(terms[5]), royaltyNumerator: u64.parse(terms[6]), royaltyDenominator: u64.parse(terms[7]),
      status: listingStatus, escrowAddress,
    };
    }, options);
  }

  async function activeListing(identity: TokenIdentity, collectionId?: string, options: RpcReadOptions = {}): Promise<MarketplaceListing | null> {
    const assetKey = marketplaceAssetKey(identity, collectionId);
    return reads.run(`${module}:active:${assetKey}:r${options.retries ?? 2}`, async () => {
    const handle = await stateHandle(options);
    try {
      const id = await aptos.getTableItem<string>({
        handle,
        data: { key_type: 'vector<u8>', value_type: 'u64', key: assetKey },
      });
      const result = await listing(id, options);
      if (result.status !== 'ACTIVE' || encodeNFTIdentity(result.identity) !== encodeNFTIdentity(identity)) throw new Error('Active listing identity mismatch');
      return result;
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
    }, options);
  }

  async function assetState(identity: TokenIdentity, collectionId?: string, minimumLedgerVersion?: string, options: RpcReadOptions = {}): Promise<MarketplaceAssetState> {
    const assetKey = marketplaceAssetKey(identity, collectionId);
    return reads.run(`${module}:asset:${assetKey}:${minimumLedgerVersion || 'latest'}:r${options.retries ?? 2}`, async () => {
    const ledger = await aptos.getLedgerInfo();
    const ledgerVersion = u64.parse(ledger.ledger_version);
    if (minimumLedgerVersion && BigInt(ledgerVersion) < BigInt(u64.parse(minimumLedgerVersion))) {
      throw new Error('Fullnode state is older than the confirmed transaction');
    }
    const [active, owner] = await Promise.all([
      activeListing(identity, collectionId, options),
      identity.standard === 'v2' ? aptos.getAccountResource<{ owner: string }>({
        accountAddress: canonical(identity.address), resourceType: '0x1::object::ObjectCore',
      }).then((core) => canonical(core.owner)) : Promise.resolve(null),
    ]);
    return { listing: active, owner, ledgerVersion };
    }, options);
  }

  async function eligibility(nft: {
    identity: TokenIdentity; owner: string; amount: string; collectionId: string;
    maximum: string | null; royalty: { payee: string; numerator: string; denominator: string } | null;
    isSoulbound: boolean;
  }, expectedOwner: string, knownOwner?: string | null, options: RpcReadOptions = {}) {
    return reads.run(`${module}:eligibility:${encodeNFTIdentity(nft.identity)}:${canonical(expectedOwner)}:${knownOwner || 'read'}`, async () => {
    const reasons: string[] = [];
    let royalty = nft.royalty;
    if (nft.identity.standard === 'v1') {
      if (canonical(nft.owner) !== canonical(expectedOwner) || BigInt(nft.amount) !== 1n) reasons.push('Connected wallet does not own exactly one Token V1 asset.');
      if (nft.maximum !== '1') reasons.push('Token V1 editions and unlimited-supply token data are not supported.');
      if (!nft.royalty || BigInt(nft.royalty.denominator) <= 0n || BigInt(nft.royalty.numerator) > BigInt(nft.royalty.denominator)) reasons.push('Token V1 royalty data is unavailable or malformed.');
    } else {
      try {
        const actualOwner = knownOwner || (await aptos.getAccountResource<{ owner: string }>({
          accountAddress: canonical(nft.identity.address), resourceType: '0x1::object::ObjectCore',
        })).owner;
        if (canonical(actualOwner) !== canonical(expectedOwner)) reasons.push('Connected wallet does not own this Digital Asset.');
      } catch { reasons.push('Digital Asset ownership could not be verified.'); }
      if (nft.isSoulbound) reasons.push('This Digital Asset is transfer restricted.');
      const [policy] = await aptos.view<[boolean, number]>({
        payload: { function: marketFn('v2_collection_policy'), functionArguments: [canonical(nft.collectionId)] },
      });
      if (!policy) reasons.push('This Digital Asset collection has not passed VEYTOS custody review.');
      try {
        const [native] = await aptos.view<[{ vec: { payee_address: string; numerator: string; denominator: string }[] }]>({
          payload: { function: '0x4::token::royalty', typeArguments: ['0x4::token::Token'], functionArguments: [canonical(nft.identity.address)] },
        });
        const value = native.vec[0];
        royalty = value ? { payee: canonical(value.payee_address), numerator: u64.parse(value.numerator), denominator: u64.parse(value.denominator) }
          : { payee: canonical('0x0'), numerator: '0', denominator: '1' };
      } catch { reasons.push('Digital Asset royalty data could not be verified.'); }
    }
    return { eligible: reasons.length === 0, reasons, royalty };
    }, options);
  }

  function listPayload(identity: TokenIdentity, price: string) {
    const amount = u64.parse(price);
    return identity.standard === 'v2'
      ? { function: `${module}::settlement_v2::list` as const, functionArguments: [canonical(identity.address), amount] }
      : { function: `${module}::settlement_v1::list` as const, functionArguments: [canonical(identity.creator), identity.collection, identity.name, u64.parse(identity.propertyVersion), amount] };
  }
  function cancelPayload(standard: 'v1' | 'v2', listingId: string) {
    return { function: `${module}::settlement_${standard}::cancel` as const, functionArguments: [u64.parse(listingId)] };
  }
  function buyPayload(listing: MarketplaceListing) {
    return {
      function: `${module}::settlement_${listing.standard}::buy` as const,
      functionArguments: [listing.id, listing.price, listing.storageReimbursement],
    };
  }

  async function reconcile(pending: PendingMarketplaceTransaction) {
    if (!pending.hash) return { status: 'no-hash' as const };
    const receipt = await aptos.getTransactionByHash({ transactionHash: pending.hash });
    if (receipt.type === 'pending_transaction') return { status: 'pending' as const };
    if (receipt.type !== 'user_transaction') throw new Error('Unexpected transaction receipt');
    const tx = receipt as UserTransactionResponse;
    if (tx.hash !== pending.hash || canonical(tx.sender) !== canonical(pending.sender)) throw new Error('Transaction identity mismatch');
    if (!tx.success) return { status: 'failed' as const, message: tx.vm_status };
    const payload = tx.payload as { function?: string; arguments?: unknown[] };
    const expectedFunction = `${module}::settlement_${pending.identity.standard}::${pending.action}`;
    if (payload.function !== expectedFunction) throw new Error('Transaction action mismatch');
    if (pending.action === 'list') {
      const event = tx.events.find((candidate) => candidate.type === `${module}::marketplace::NFTListed`);
      if (!event || canonical(String(event.data.seller)) !== canonical(pending.sender)) throw new Error('Listing event mismatch');
      const current = await listing(String(event.data.listing_id));
      if (current.status !== 'ACTIVE' || encodeNFTIdentity(current.identity) !== encodeNFTIdentity(pending.identity) ||
          current.seller !== canonical(pending.sender) || current.price !== pending.expectedPrice) throw new Error('Active listing mismatch');
      if (pending.identity.standard === 'v2') {
        const [token] = await aptos.view<[string]>({ payload: { function: `${module}::settlement_v2::escrow_token`, functionArguments: [current.id] }, options: { ledgerVersion: BigInt(tx.version) } });
        if (canonical(token) !== canonical(pending.identity.address) || !current.escrowAddress) throw new Error('V2 escrow mismatch');
        await assertOwner(pending.identity, current.escrowAddress, BigInt(tx.version));
      } else {
        const [hasEscrow] = await aptos.view<[boolean]>({ payload: { function: `${module}::settlement_v1::has_escrow`, functionArguments: [current.id] }, options: { ledgerVersion: BigInt(tx.version) } });
        const escrowIdentity = await aptos.view<[string, string, string, string]>({ payload: { function: `${module}::settlement_v1::escrow_token_id`, functionArguments: [current.id] }, options: { ledgerVersion: BigInt(tx.version) } });
        if (!hasEscrow || canonical(escrowIdentity[0]) !== canonical(pending.identity.creator) || escrowIdentity[1] !== pending.identity.collection || escrowIdentity[2] !== pending.identity.name || escrowIdentity[3] !== pending.identity.propertyVersion) throw new Error('V1 escrow mismatch');
      }
      return { status: 'success' as const, listing: current, receipt: tx };
    }
    const id = u64.parse(pending.listingId);
    const current = await listing(id);
    if (encodeNFTIdentity(current.identity) !== encodeNFTIdentity(pending.identity)) throw new Error('Listing identity mismatch');
    if (pending.action === 'cancel') {
      const event = tx.events.find((candidate) => candidate.type === `${module}::marketplace::ListingCancelled`);
      if (!event || String(event.data.listing_id) !== id || current.status !== 'CANCELLED') throw new Error('Cancellation mismatch');
      await assertOwner(current.identity, pending.sender, BigInt(tx.version));
    } else {
      const event = tx.events.find((candidate) => candidate.type === `${module}::marketplace::NFTPurchased`);
      if (!event || String(event.data.listing_id) !== id || canonical(String(event.data.buyer)) !== canonical(pending.sender) || current.status !== 'SOLD') throw new Error('Purchase mismatch');
      if (String(event.data.gross_price) !== pending.expectedPrice || String(event.data.storage_reimbursement) !== pending.expectedStorageReimbursement) throw new Error('Purchase economics mismatch');
      await assertOwner(current.identity, pending.sender, BigInt(tx.version));
    }
    return { status: 'success' as const, listing: current, receipt: tx };
  }

  async function assertOwner(identity: TokenIdentity, expectedOwner: string, ledgerVersion: bigint) {
    if (identity.standard === 'v2') {
      const core = await aptos.getAccountResource<{ owner: string }>({
        accountAddress: canonical(identity.address), resourceType: '0x1::object::ObjectCore', options: { ledgerVersion },
      });
      if (canonical(core.owner) !== canonical(expectedOwner)) throw new Error('NFT ownership mismatch');
      return;
    }
    const [balance] = await aptos.view<[string]>({
      payload: {
        function: `${module}::settlement_v1::token_balance`,
        functionArguments: [canonical(expectedOwner), canonical(identity.creator), identity.collection, identity.name, u64.parse(identity.propertyVersion)],
      },
      options: { ledgerVersion },
    });
    if (balance !== '1') throw new Error('NFT ownership mismatch');
  }

  return { config, pauseState, listing, activeListing, assetState, eligibility, listPayload, cancelPayload, buyPayload, reconcile, module };
}
