import test from 'node:test';
import assert from 'node:assert/strict';
import { launchpadEvents,requestHeaders,retryDelay } from '../indexer-runtime.ts';
const module='0x'+'a'.repeat(64);
test('launchpad projection accepts only successful matching user transaction events',()=>{const projected=launchpadEvents({type:'user_transaction',success:true,version:'9',hash:'0x'+'1'.repeat(64),timestamp:'1000000',events:[{type:`${module}::launchpad::NFTMinted`,data:{token:'x'}},{type:'0x1::coin::WithdrawEvent',data:{}}]},module);assert.equal(projected.length,1);assert.equal(projected[0]?.eventType,'NFTMinted');assert.equal(launchpadEvents({type:'user_transaction',success:false,events:[]},module).length,0);});
test('managed RPC headers remain server-only and optional',()=>{assert.deepEqual(requestHeaders(),{});assert.deepEqual(requestHeaders('secret'),{Authorization:'Bearer secret'});});
test('indexer backoff is bounded and respects Retry-After',()=>{assert.equal(retryDelay(null,0,1000),1000);assert.equal(retryDelay(null,9,1000),16000);assert.equal(retryDelay({status:429,headers:new Headers({'retry-after':'4'})},0,1000),4000);assert.equal(retryDelay({status:429,headers:new Headers({'retry-after':'999'})},0,1000),60000);});
