import {expect,test,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const navigation=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>navigation}));
import {LaunchpadActivity} from '../src/components/launchpad-activity';
import {CollectionLinks} from '../src/components/collection-links';
import {RetryLaunchpad} from '../src/components/retry-launchpad';

test('optional activity failure does not collapse core collection content',()=>{render(<><h1>Core mint event</h1><LaunchpadActivity mints={[]} mintsConfigured mintsFailed sales={[]} salesConfigured salesFailed/></>);expect(screen.getByRole('heading',{name:'Core mint event'})).toBeTruthy();expect(screen.getByText('Mint activity unavailable')).toBeTruthy();});
test('missing local projection is distinguished from an indexed empty feed',()=>{render(<LaunchpadActivity mints={[]} mintsConfigured={false} mintsFailed={false} sales={[]} salesConfigured={false} salesFailed={false}/>);expect(screen.getByText('Indexed activity is not connected')).toBeTruthy();});
test('optional metadata failure leaves core content rendered',()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><h1>Core mint event</h1><CollectionLinks uri="invalid://metadata"/></QueryClientProvider>);expect(screen.getByRole('heading',{name:'Core mint event'})).toBeTruthy();});
test('route retry requests fresh server data without a browser reload',async()=>{navigation.refresh.mockClear();render(<RetryLaunchpad/>);fireEvent.click(screen.getByRole('button',{name:'Try again'}));await waitFor(()=>expect(navigation.refresh).toHaveBeenCalledOnce());});
