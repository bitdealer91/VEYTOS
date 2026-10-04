import {beforeEach,expect,test,vi} from 'vitest';
import type {Drop} from '@veytos/aptos/types';
import {readLaunchpadSnapshot,type LaunchpadSnapshot} from '../src/lib/launchpad-read';

const drop:Drop={address:'0x2',collection:'0x4',finalized:true,creator_paused:false,admin_paused:false,minted:'2',uploaded:'100',terms:{creator:'0x5',name:'Test drop',description:'',collection_uri:'',max_supply:'100',unit_price:'10000000',wallet_limit:'10',transaction_limit:'5',start_seconds:'0',end_seconds:'0',royalty_bps:'750',fee_bps:'500'}};
const snapshot:LaunchpadSnapshot={drop,now:'1000',chainId:2,paused:false,walletMinted:'0'};
const base={dropId:'0x2',network:'testnet',serverNetwork:'testnet',publicPackage:'0x1',serverPackage:'0x1',nowSeconds:1000n,requestId:'request-test'};
beforeEach(()=>vi.spyOn(console,'error').mockImplementation(()=>{}));
test('successful authoritative read returns fresh Drop state',async()=>{const value=await readLaunchpadSnapshot({...base,read:async()=>snapshot});expect(value.ok&&value.snapshot.drop.terms.name).toBe('Test drop');});
test('required mint-state failure stays fail closed',async()=>{const value=await readLaunchpadSnapshot({...base,read:async()=>{throw new Error('fullnode fetch failed');}});expect(value).toMatchObject({ok:false,reason:'rpc_unavailable'});});
test('stale critical state is never returned as live',async()=>{const value=await readLaunchpadSnapshot({...base,nowSeconds:1300n,read:async()=>snapshot});expect(value).toMatchObject({ok:false,reason:'stale_chain_state'});});
test('malformed chain identity is categorized',async()=>{const value=await readLaunchpadSnapshot({...base,read:async()=>({...snapshot,drop:{...drop,address:'0x9'}})});expect(value).toMatchObject({ok:false,reason:'malformed_chain_response'});});
test('network and package mismatches return useful diagnostics',async()=>{expect(await readLaunchpadSnapshot({...base,serverNetwork:'mainnet',read:async()=>snapshot})).toMatchObject({ok:false,reason:'network_mismatch'});expect(await readLaunchpadSnapshot({...base,serverPackage:'0x8',read:async()=>snapshot})).toMatchObject({ok:false,reason:'package_mismatch'});});
test('a successful retry recovers without retaining the prior failure',async()=>{const read=vi.fn<()=>Promise<LaunchpadSnapshot>>().mockRejectedValueOnce(new Error('RPC network unavailable')).mockResolvedValueOnce(snapshot);expect((await readLaunchpadSnapshot({...base,read})).ok).toBe(false);expect((await readLaunchpadSnapshot({...base,read})).ok).toBe(true);});
