import { test } from "node:test";
import assert from "node:assert/strict";
import { parseApt, formatApt, quoteMint, U64_MAX, INITIAL_FEE_BPS } from "../src/money.js";

test("APT parsing preserves octas and the full u64 range", () => {
  assert.equal(parseApt("0.00000001"), 1n);
  assert.equal(parseApt("1.025"), 102_500_000n);
  assert.equal(parseApt("184467440737.09551615"), U64_MAX);
  for (const amount of [0n, 1n, 99n, 100_000_000n, U64_MAX]) assert.equal(parseApt(formatApt(amount)), amount);
});

test("invalid and overflowing monetary inputs are rejected", () => {
  for (const value of ["-1", "1e9", "1.000000001", "NaN", "Infinity", "", "01", " 1", "1.", "184467440737.09551616"]) {
    assert.throws(() => parseApt(value));
  }
  assert.throws(() => quoteMint(U64_MAX, 2n, 250n));
  assert.throws(() => quoteMint(1n, 0n, 250n));
  assert.throws(() => quoteMint(1n, 1n, 1001n));
  assert.throws(() => quoteMint(1n, 1n, -1n));
});

test("fees conserve payment and are independent of batch partitioning", () => {
  assert.deepEqual(quoteMint(100_000_000n, 2n, INITIAL_FEE_BPS), { total: 200_000_000n, fee: 10_000_000n, creatorRevenue: 190_000_000n });
  for (const price of [0n, 1n, 39n, 40n, 999n, 100_000_000n, U64_MAX / 10n]) {
    for (const bps of [0n, 1n, 250n, 500n, 1000n]) {
      const batch = quoteMint(price, 10n, bps);
      const single = quoteMint(price, 1n, bps);
      assert.equal(batch.total, batch.fee + batch.creatorRevenue);
      assert.equal(batch.fee, single.fee * 10n);
      assert(batch.fee <= batch.total);
    }
  }
});
