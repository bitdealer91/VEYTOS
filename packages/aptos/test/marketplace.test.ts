import test from 'node:test';
import assert from 'node:assert/strict';
import type { Aptos } from '@aptos-labs/ts-sdk';
import { decodeNFTIdentity, encodeNFTIdentity, marketplace, marketplaceAssetKey, marketplacePaused, quoteMarketplaceSale } from '../src/marketplace.ts';
import { projectMarketplaceTransaction } from '../src/marketplace-events.ts';
import { discoverOwnedNFTPage } from '../src/discovery.ts';

const module = '0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb';
const seller = '0x000000000000000000000000000000000000000000000000000000000000000a';
const buyer = '0x000000000000000000000000000000000000000000000000000000000000000b';
const creator = '0x000000000000000000000000000000000000000000000000000000000000000f';
const v1 = { standard: 'v1' as const, creator, collection: 'Legacy / Collection', name: 'NFT #1', propertyVersion: '7' };
const v2 = { standard: 'v2' as const, address: '0x0000000000000000000000000000000000000000000000000000000000000011' };

test('listing review economics conserve price and expose storage reimbursement', () => {
  const quote = quoteMarketplaceSale(1_000_000_000n, 200n, 750n, 10_000n, 926_400n);
  assert.deepEqual(quote, { price: 1_000_000_000n, fee: 20_000_000n, royalty: 75_000_000n, sellerProceeds: 905_000_000n, storageReimbursement: 926_400n, buyerTotalBeforeGas: 1_000_926_400n });
});
test('V1 route identity round trips unicode and property version', () => assert.deepEqual(decodeNFTIdentity(encodeNFTIdentity(v1)), v1));
test('V2 route identity round trips canonical object address', () => assert.deepEqual(decodeNFTIdentity(encodeNFTIdentity(v2)), v2));
test('malformed route identity fails closed', () => assert.throws(() => decodeNFTIdentity('veytos-nft-zz')));
test('global and standard pauses are independent', () => {
  const base = { chainId:2,feeBps:'200',recipient:seller,globalPaused:false,v1Paused:false,v2Paused:true,admin:seller,v1StorageReimbursement:'1',v2StorageReimbursement:'2' };
  assert.equal(marketplacePaused(base, 'v1'), false); assert.equal(marketplacePaused(base, 'v2'), true);
  assert.equal(marketplacePaused({ ...base, globalPaused: true }, 'v1'), true);
});
test('invalid royalty and zero price fail before wallet submission', () => {
  assert.throws(() => quoteMarketplaceSale(0n, 200n, 0n, 1n, 0n));
  assert.throws(() => quoteMarketplaceSale(1n, 200n, 2n, 1n, 0n));
});
test('V1 listing payload preserves exact property version', () => {
  const payload = marketplace({} as Aptos, module).listPayload(v1, '100');
  assert.equal(payload.function, `${module}::settlement_v1::list`);
  assert.deepEqual(payload.functionArguments.slice(-2), ['7', '100']);
});
test('V2 listing payload uses exact object identity', () => {
  const payload = marketplace({} as Aptos, module).listPayload(v2, '100');
  assert.equal(payload.function, `${module}::settlement_v2::list`);
  assert.equal(payload.functionArguments[0], v2.address);
});
test('canonical marketplace asset keys distinguish V1 property versions and V2 objects', () => {
  const v1Next = { ...v1, propertyVersion: '8' };
  assert.match(marketplaceAssetKey(v2, creator), /^0x[0-9a-f]+$/);
  assert.notEqual(marketplaceAssetKey(v1), marketplaceAssetKey(v1Next));
  assert.notEqual(marketplaceAssetKey(v1), marketplaceAssetKey(v2, creator));
});
test('direct asset state uses active_assets and reports escrow ownership despite stale discovery', async () => {
  let tableRequest: unknown;
  const escrow = '0x0000000000000000000000000000000000000000000000000000000000000012';
  const aptos = {
    getLedgerInfo: async () => ({ ledger_version: '100' }),
    getAccountResource: async ({ accountAddress, resourceType }: { accountAddress: string; resourceType: string }) =>
      resourceType.endsWith('::marketplace::State') ? { active_assets: { handle: '0x123' } }
        : accountAddress === v2.address ? { owner: escrow } : Promise.reject(new Error('unexpected resource')),
    getTableItem: async (request: unknown) => { tableRequest = request; return '9'; },
    view: async ({ payload }: { payload: { function: string } }) => {
      if (payload.function.endsWith('listing_terms')) return [seller, 2, '100', '200', '926400', creator, '750', '10000', 1];
      if (payload.function.endsWith('listing_asset')) return [{ standard: 2, v1_creator: '0x0', v1_collection: '', v1_token: '', v1_property_version: '0', v2_token: v2.address, collection: creator }];
      if (payload.function.endsWith('escrow_address')) return [escrow];
      throw new Error('unexpected view');
    },
  } as unknown as Aptos;
  const state = await marketplace(aptos, module).assetState(v2, creator);
  assert.equal(state.listing?.status, 'ACTIVE'); assert.equal(state.owner, escrow); assert.equal(state.ledgerVersion, '100');
  assert.deepEqual(tableRequest, { handle: '0x123', data: { key_type: 'vector<u8>', value_type: 'u64', key: marketplaceAssetKey(v2, creator) } });
});
test('a fullnode behind a confirmed transaction cannot regress marketplace state', async () => {
  const aptos = { getLedgerInfo: async () => ({ ledger_version: '99' }) } as unknown as Aptos;
  await assert.rejects(() => marketplace(aptos, module).assetState(v2, creator, '100'), /older than the confirmed transaction/);
});
test('buy payload includes immutable expected price and reimbursement', () => {
  const listing = { id:'9',seller,standard:'v2' as const,identity:v2,collectionId:creator,price:'100',feeBps:'200',storageReimbursement:'926400',royaltyPayee:creator,royaltyNumerator:'750',royaltyDenominator:'10000',status:'ACTIVE' as const,escrowAddress:seller };
  assert.deepEqual(marketplace({} as Aptos, module).buyPayload(listing).functionArguments, ['9','100','926400']);
});
test('cancel payload remains constructible independently of pause state', () => {
  assert.equal(marketplace({} as Aptos, module).cancelPayload('v1','4').function, `${module}::settlement_v1::cancel`);
});

const listedData = {
  listing_id:'1', asset:{standard:1,v1_creator:creator,v1_collection:'Legacy / Collection',v1_token:'NFT #1',v1_property_version:'7',v2_token:'0x0',collection:creator},
  seller, gross_price:'100',fee_bps:'200',storage_reimbursement:'926400',royalty_payee:creator,royalty_numerator:'750',royalty_denominator:'10000',timestamp:'10',
};
test('projector accepts successful correctly filtered marketplace events', () => {
  const events = projectMarketplaceTransaction({type:'user_transaction',success:true,version:'5',hash:`0x${'1'.repeat(64)}`,timestamp:'1000000',events:[{type:`${module}::marketplace::NFTListed`,data:listedData}]},module);
  assert.equal(events.length,1); assert.equal(events[0]!.assetKey,encodeNFTIdentity(v1)); assert.equal(events[0]!.eventType,'LISTED');
});
test('projector ignores failed transactions and foreign modules', () => {
  const base={type:'user_transaction',version:'5',hash:`0x${'1'.repeat(64)}`,timestamp:'1000000',events:[{type:`0x1::marketplace::NFTListed`,data:listedData}]};
  assert.deepEqual(projectMarketplaceTransaction({...base,success:true},module),[]);
  assert.deepEqual(projectMarketplaceTransaction({...base,success:false,events:[{type:`${module}::marketplace::NFTListed`,data:listedData}]},module),[]);
});
test('purchase projection retains buyer and exact gross price', () => {
  const data={...listedData,buyer,platform_fee_recipient:seller,platform_fee:'2',royalty_recipient:creator,royalty:'7',seller_proceeds:'91'};
  const [event]=projectMarketplaceTransaction({type:'user_transaction',success:true,version:'6',hash:`0x${'2'.repeat(64)}`,timestamp:'1000000',events:[{type:`${module}::marketplace::NFTPurchased`,data}]},module);
  assert.equal(event!.buyer,buyer); assert.equal(event!.grossPrice,'100');
});
test('profile pagination requests one lookahead row and reports hasMore', async () => {
  const row=(id:number)=>({token_standard:'v2',token_data_id:`0x${id.toString(16)}`,property_version_v1:'0',owner_address:seller,last_transaction_version:String(id),amount:'1',is_soulbound_v2:false,current_token_data:{collection_id:creator,description:'',token_data_id:`0x${id.toString(16)}`,token_name:`NFT ${id}`,token_standard:'v2',token_uri:'',maximum:'1',token_properties:{},current_collection:{collection_id:creator,collection_name:'C',creator_address:creator,token_standard:'v2',uri:''}}});
  let options: unknown;
  const aptos={getAccountOwnedTokens:async(input:unknown)=>{options=input;return [row(1),row(2),row(3)];}} as unknown as Aptos;
  const page=await discoverOwnedNFTPage(aptos,seller,{offset:24,pageSize:2});
  assert.equal(page.items.length,2);assert.equal(page.hasMore,true);assert.deepEqual((options as {options:{offset:number;limit:number}}).options,{offset:24,limit:3,orderBy:[{last_transaction_version:'desc'},{token_data_id:'asc'},{property_version_v1:'asc'}]});
});
test('empty profile page remains a successful authoritative result', async () => {
  const aptos={getAccountOwnedTokens:async()=>[]} as unknown as Aptos;
  const page=await discoverOwnedNFTPage(aptos,seller);assert.deepEqual(page.items,[]);assert.equal(page.hasMore,false);
});
test('no-hash marketplace request never claims submission', async () => {
  const result=await marketplace({} as Aptos,module).reconcile({action:'list',hash:'',sender:seller,identity:v1,network:'testnet',module});
  assert.equal(result.status,'no-hash');
});
test('committed transaction failure stays failed without state guessing', async () => {
  const aptos={getTransactionByHash:async()=>({type:'user_transaction',hash:`0x${'3'.repeat(64)}`,sender:seller,success:false,vm_status:'abort',events:[]})} as unknown as Aptos;
  const result=await marketplace(aptos,module).reconcile({action:'cancel',hash:`0x${'3'.repeat(64)}`,sender:seller,listingId:'1',identity:v1,network:'testnet',module});
  assert.equal(result.status,'failed');
});
test('purchase reconciliation verifies SOLD state, buyer and reviewed economics', async () => {
  const hash=`0x${'4'.repeat(64)}`;
  const aptos={
    getTransactionByHash:async()=>({type:'user_transaction',hash,sender:buyer,success:true,version:'99',vm_status:'Executed',payload:{function:`${module}::settlement_v2::buy`},events:[{type:`${module}::marketplace::NFTPurchased`,data:{listing_id:'1',buyer,gross_price:'100',storage_reimbursement:'926400'}}]}),
    getAccountResource:async()=>({owner:buyer}),
    view:async({payload}:{payload:{function:string}})=>payload.function.endsWith('listing_terms')
      ? [seller,2,'100','200','926400',creator,'750','10000',3]
      : [{standard:2,v1_creator:'0x0',v1_collection:'',v1_token:'',v1_property_version:'0',v2_token:v2.address,collection:creator}],
  } as unknown as Aptos;
  const result=await marketplace(aptos,module).reconcile({action:'buy',hash,sender:buyer,listingId:'1',identity:v2,expectedPrice:'100',expectedStorageReimbursement:'926400',network:'testnet',module});
  assert.equal(result.status,'success');if(result.status==='success')assert.equal(result.listing.status,'SOLD');
});
