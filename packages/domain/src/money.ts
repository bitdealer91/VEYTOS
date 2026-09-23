export const OCTAS_PER_APT = 100_000_000n;
export const U64_MAX = (1n << 64n) - 1n;
export const MAX_FEE_BPS = 1_000n;
export const INITIAL_FEE_BPS = 500n;

export function assertU64(value: bigint, label = "Amount"): bigint {
  if (value < 0n || value > U64_MAX) throw new Error(`${label} is outside u64 range`);
  return value;
}

/** Parse user input exactly. Scientific notation and sub-octa prices are invalid. */
export function parseApt(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value)) {
    throw new Error("Enter an APT amount with at most 8 decimal places");
  }
  const [whole, fraction = ""] = value.split(".");
  return assertU64(BigInt(whole!) * OCTAS_PER_APT + BigInt(fraction.padEnd(8, "0")));
}

export function formatApt(octas: bigint): string {
  assertU64(octas);
  const whole = octas / OCTAS_PER_APT;
  const fraction = (octas % OCTAS_PER_APT).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Per-token rounding keeps treasury revenue invariant under batch partitioning. */
export function quoteMint(unitPrice: bigint, quantity: bigint, feeBps: bigint) {
  assertU64(unitPrice, "Price");
  assertU64(quantity, "Quantity");
  if (quantity === 0n) throw new Error("Quantity must be positive");
  if (feeBps < 0n || feeBps > MAX_FEE_BPS) throw new Error("Platform fee exceeds its cap");
  const total = assertU64(unitPrice * quantity, "Total");
  const fee = (unitPrice * feeBps / 10_000n) * quantity;
  return { total, fee, creatorRevenue: total - fee };
}
