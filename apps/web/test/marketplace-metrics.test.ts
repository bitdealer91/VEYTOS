import { expect, test } from 'vitest';
import { floorChange, listedShare } from '../src/lib/marketplace-metrics';

test('floor change compares current floor with the reconstructed 24h floor', () => {
  expect(floorChange('125000000', '100000000')).toEqual({ label: '+25.0% 24h', trend: 'up' });
  expect(floorChange('75000000', '100000000')).toEqual({ label: '−25.0% 24h', trend: 'down' });
  expect(floorChange('100000000', '100000000')).toEqual({ label: '0.0% 24h', trend: 'flat' });
  expect(floorChange(null, '100000000')).toBeNull();
  expect(floorChange('100000000', null)).toBeNull();
});

test('listed share uses canonical supply and omits unavailable denominators', () => {
  expect(listedShare('8', '187')).toBe('4.2% of supply');
  expect(listedShare(0n, '187')).toBe('0.0% of supply');
  expect(listedShare('8', null)).toBeNull();
  expect(listedShare('8', '0')).toBeNull();
});
