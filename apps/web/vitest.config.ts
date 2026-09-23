import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 test:{environment:'jsdom',include:['test/**/*.test.tsx'],setupFiles:['./test/setup.ts'],env:{NEXT_PUBLIC_APTOS_NETWORK:'testnet',NEXT_PUBLIC_LAUNCHPAD_ADDRESS:'0x1'}},
});
