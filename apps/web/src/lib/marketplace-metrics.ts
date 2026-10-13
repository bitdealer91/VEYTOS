export type MetricTrend = 'up' | 'down' | 'flat';

function decimalPercent(tenths: bigint, signed: boolean) {
  const negative = tenths < 0n;
  const absolute = negative ? -tenths : tenths;
  const sign = negative ? '−' : signed && tenths > 0n ? '+' : '';
  return `${sign}${absolute / 10n}.${absolute % 10n}%`;
}

export function floorChange(current: string | null, previous: string | null): { label: string; trend: MetricTrend } | null {
  if (!current || !previous) return null;
  const currentValue = BigInt(current);
  const previousValue = BigInt(previous);
  if (previousValue <= 0n) return null;
  const change = currentValue - previousValue;
  const tenths = change * 1000n / previousValue;
  return { label: `${decimalPercent(tenths, true)} 24h`, trend: change > 0n ? 'up' : change < 0n ? 'down' : 'flat' };
}

export function listedShare(listed: string | bigint, supply: string | null): string | null {
  if (!supply) return null;
  const supplyValue = BigInt(supply);
  if (supplyValue <= 0n) return null;
  const listedValue = typeof listed === 'bigint' ? listed : BigInt(listed);
  return `${decimalPercent(listedValue * 1000n / supplyValue, false)} of supply`;
}
