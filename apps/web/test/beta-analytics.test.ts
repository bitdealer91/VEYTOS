import { expect,test } from 'vitest';
import { analyticsPath } from '../src/components/beta-analytics';
test('analytics paths remove public wallet and NFT identities',()=>{expect(analyticsPath('/profile/0xabc')).toBe('/profile/[address]');expect(analyticsPath('/nft/veytos-nft-secret')).toBe('/nft/[token]');expect(analyticsPath('/collection/0x123')).toBe('/collection/[id]');expect(analyticsPath('/explore')).toBe('/explore');});
