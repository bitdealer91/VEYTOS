import {expect,test,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
vi.mock('@/lib/metadata',()=>({loadMetadata:vi.fn()}));
import {loadMetadata} from '../src/lib/metadata';
import {Artwork} from '../src/components/artwork';
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><Artwork uri="ipfs://test-fixture" name="Test NFT"/></QueryClientProvider>);}
test('unavailable metadata renders labelled fallback',async()=>{vi.mocked(loadMetadata).mockRejectedValue(new Error('Gateway unavailable'));mount();expect(await screen.findByText('Artwork unavailable')).toBeTruthy();expect(screen.queryByRole('img')).toBe(null);});
test('failed artwork image falls back without breaking the card',async()=>{vi.mocked(loadMetadata).mockResolvedValue({image:'https://example.com/test.png',description:null});mount();fireEvent.error(await screen.findByRole('img',{name:'Test NFT'}));expect(screen.getByText('Artwork unavailable')).toBeTruthy();expect(screen.queryByRole('img')).toBe(null);});
