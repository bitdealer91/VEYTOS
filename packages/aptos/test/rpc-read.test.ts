import test from 'node:test';
import assert from 'node:assert/strict';
import { RpcReadCoordinator, isRateLimitError } from '../src/rpc-read.ts';

test('two marketplace State consumers share one underlying request', async () => {
  const coordinator = new RpcReadCoordinator();
  let calls = 0;
  let release!: (value: string) => void;
  const pending = new Promise<string>((resolve) => { release = resolve; });
  const read = () => { calls += 1; return pending; };
  const first = coordinator.run('marketplace:State', read);
  const second = coordinator.run('marketplace:State', read);
  assert.equal(calls, 1);
  release('0xhandle');
  assert.deepEqual(await Promise.all([first, second]), ['0xhandle', '0xhandle']);
});

test('two V2 owner consumers share one ObjectCore request', async () => {
  const coordinator = new RpcReadCoordinator();
  let calls = 0;
  const read = async () => { calls += 1; await Promise.resolve(); return '0xowner'; };
  const values = await Promise.all([
    coordinator.run('ObjectCore:0xasset', read),
    coordinator.run('ObjectCore:0xasset', read),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(values, ['0xowner', '0xowner']);
});

test('429 retries are bounded and use exponential backoff without an immediate storm', async () => {
  const coordinator = new RpcReadCoordinator();
  const delays: number[] = [];
  let calls = 0;
  const read = async () => { calls += 1; throw Object.assign(new Error('429 Too Many Requests'), { status: 429 }); };
  const requests = Array.from({ length: 8 }, () => coordinator.run('same-read', read, {
    retries: 2, retryBaseMs: 1000, random: () => 0.5, sleep: async (delay) => { delays.push(delay); },
  }));
  await assert.rejects(requests[0]!, /429/);
  await Promise.allSettled(requests.slice(1));
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test('Retry-After is recognized and non-rate-limit errors are never retried', async () => {
  assert.equal(isRateLimitError({ response: { status: 429 } }), true);
  const coordinator = new RpcReadCoordinator();
  const delays: number[] = [];
  let calls = 0;
  await assert.rejects(() => coordinator.run('bad-request', async () => {
    calls += 1;
    throw Object.assign(new Error('bad request'), { status: 400 });
  }, { retries: 3, sleep: async (delay) => { delays.push(delay); } }), /bad request/);
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});
