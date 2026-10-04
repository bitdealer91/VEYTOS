import {beforeEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../src/lib/database',()=>({database:()=>({query:mocks.query})}));
vi.mock('../src/lib/config',()=>({network:'testnet',packageAddress:`0x${'5'.repeat(64)}`}));
vi.mock('../src/lib/chain',()=>({aptos:{},chain:vi.fn()}));
import {launchpadActivityFor} from '../src/lib/data';

beforeEach(()=>vi.clearAllMocks());

test('mint activity query normalizes short event addresses before matching a canonical drop',async()=>{
  mocks.query.mockResolvedValue({rows:[{payload:{drop:`0x${'a'.repeat(63)}`,collection:'0x2',token:'0x3',buyer:'0x4',creator:'0x5',treasury:'0x6',serial:'3',unit_price:'1',fee:'0',creator_revenue:'1',timestamp:'1'},transaction_hash:`0x${'7'.repeat(64)}`,transaction_version:'10',chain_timestamp:'2026-10-04T00:00:00.000Z'}]});
  const result=await launchpadActivityFor(`0x0${'a'.repeat(63)}`);
  expect(result.events).toHaveLength(1);
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("lpad(regexp_replace(lower(payload->>'drop'),'^0x',''),64,'0')=substring($3 from 3)"),['testnet',`0x${'5'.repeat(64)}`,`0x0${'a'.repeat(63)}`]);
});
