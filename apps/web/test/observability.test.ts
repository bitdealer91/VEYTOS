import { expect,test } from 'vitest';
import { errorCategory } from '../src/lib/observability';
test('production errors are categorized without exposing raw payloads',()=>{expect(errorCategory(new Error('HTTP 429'))).toBe('rpc_rate_limit');expect(errorCategory(new Error('Indexer GraphQL error'))).toBe('indexer_failure');expect(errorCategory(new Error('Move abort code 7'))).toBe('move_abort');expect(errorCategory(new Error('Metadata unavailable'))).toBe('metadata_failure');expect(errorCategory(new Error('Petra rejected request'))).toBe('wallet_adapter');});
