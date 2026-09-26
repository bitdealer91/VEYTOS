import 'server-only';
import pg from 'pg';
declare global{var __veytosPool:pg.Pool|undefined;}
export function database(){const url=process.env.DATABASE_URL;if(!url)return null;globalThis.__veytosPool??=new pg.Pool({connectionString:url,max:4,idleTimeoutMillis:30_000,connectionTimeoutMillis:5_000});return globalThis.__veytosPool;}
