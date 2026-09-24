import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 test:{environment:'jsdom',include:['test/**/*.test.tsx'],setupFiles:['./test/setup.ts'],env:{NEXT_PUBLIC_APTOS_NETWORK:'testnet',NEXT_PUBLIC_LAUNCHPAD_ADDRESS:'0x1',NEXT_PUBLIC_MARKETPLACE_ADDRESS:'0x40fcdc2583e3e15c09f20a5d777b72f7bec8a9ac9292d57c03e9fb23c091eebb'}},
});
