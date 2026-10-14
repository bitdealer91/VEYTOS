import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const standard of ['v1', 'v2']) {
  test(`settlement_${standard} protected LIST is package-only`, async () => {
    const source = await readFile(`move/marketplace/sources/settlement_${standard}.move`, 'utf8');
    assert.match(source, /public\(package\) entry fun list_with_terms\s*\(/);
    assert.doesNotMatch(source, /\bpublic entry fun list_with_terms\s*\(/);
  });
}
