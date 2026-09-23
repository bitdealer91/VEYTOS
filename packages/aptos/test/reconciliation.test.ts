import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {makeAptos,launchpad} from '../src/client.ts';
import {canonical} from '../src/domain.ts';
import type {PendingMint,Drop} from '../src/types.ts';
const addr = (hex: string) =>
  canonical(`0x${hex.replace(/^0x/, '').padStart(64, '0')}`);

const module = addr('cafe');
const dropAddress = addr('2');
const buyer = addr('3');
const collection = addr('4');
const token = addr('5');
const pending:PendingMint={hash:'0x'+'a'.repeat(64),sender:buyer,drop:dropAddress,quantity:1,unitPrice:'10000000',network:'testnet',module};
const drop:Drop={address:dropAddress,collection,finalized:true,creator_paused:false,admin_paused:false,minted:'1',uploaded:'100',terms:{creator:canonical('0x6'),name:'Test fixture',description:'',collection_uri:'',max_supply:'100',unit_price:'10000000',wallet_limit:'10',transaction_limit:'5',start_seconds:'0',end_seconds:'0',royalty_bps:'750',fee_bps:'500'}};
function setup({owner=buyer,eventBuyer=buyer,success=true,receiptHash=pending.hash}={}){
 const sdk=makeAptos('testnet');const versions:unknown[]=[];
 mock.method(sdk,'getTransactionByHash',async()=>({type:'user_transaction',hash:receiptHash,sender:buyer,success,vm_status:success?'Executed successfully':'ESUPPLY',version:'12345',payload:{function:`${module}::launchpad::mint`,arguments:[dropAddress,'1','10000000','10000000']},events:[{type:`${module}::launchpad::NFTMinted`,data:{buyer:eventBuyer,drop:dropAddress,collection,token}}]}));
 mock.method(sdk,'view',async({payload,options}:{payload:{function:string};options?:{ledgerVersion?:bigint}})=>{if(payload.function==='0x4::token::name'){versions.push(options?.ledgerVersion);return ['Concurrent token name'];}return [drop];});
 mock.method(sdk,'getAccountResource',async({resourceType,options}:{resourceType:string;options?:{ledgerVersion?:bigint}})=>{versions.push(options?.ledgerVersion);return resourceType==='0x4::token::Token'?{name:'',uri:'ipfs://unavailable',collection:{inner:collection}}:{owner};});
 return {client:launchpad(sdk,module),versions,sdk};
}
test('reconciliation verifies ownership at committed version and native token name',async()=>{const {client,versions}=setup();const result=await client.reconcile(pending);assert.equal(result.status,'success');if(result.status!=='success')throw new Error('Expected success');assert.equal(result.assets[0]?.name,'Concurrent token name');assert.equal(result.assets[0]?.owner,buyer);assert.deepEqual(versions,[12345n,12345n,12345n]);});
test('mismatched receipt, event buyer and ownership cannot become success',async()=>{for(const options of [{receiptHash:'0x'+'b'.repeat(64)},{eventBuyer:canonical('0x7')},{owner:canonical('0x7')}]){const {client}=setup(options);await assert.rejects(client.reconcile(pending),/mismatch/i);}});
test('committed failure and pending transaction stay distinct',async()=>{const {client}=setup({success:false});assert.deepEqual(await client.reconcile(pending),{status:'failed',message:'ESUPPLY'});const pendingSetup=setup();mock.method(pendingSetup.sdk,'getTransactionByHash',async()=>({type:'pending_transaction'}));assert.deepEqual(await pendingSetup.client.reconcile(pending),{status:'pending'});});
