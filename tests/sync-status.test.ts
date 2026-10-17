import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('LastUpdated is driven by an API value instead of the browser clock', () => {
  const source = read('src/components/LastUpdated.tsx');

  assert.match(source, /value:\s*string\s*\|\s*null/);
  assert.doesNotMatch(source, /new Date\(\)\.toLocaleDateString/);
});

test('data pages render freshness and visible fallback labels', () => {
  const pages = [
    'src/app/page.tsx',
    'src/app/social/page.tsx',
    'src/app/content/page.tsx',
  ].map(read).join('\n');

  assert.match(pages, /<LastUpdated value=/);
  assert.match(pages, /formatFreshnessLabel/);
  assert.match(read('src/lib/data-slices.ts'), /最新可用数据/);
});

test('sync status API and admin panel expose failures and retry controls', () => {
  const route = read('src/app/api/sync-status/route.ts');
  const panel = read('src/components/admin/SyncStatusPanel.tsx');
  const admin = read('src/app/admin/page.tsx');

  assert.match(route, /getLatestSyncStatus/);
  assert.match(panel, /error_message/);
  assert.match(panel, /重新同步/);
  assert.match(panel, /canRetrySync/);
  assert.match(panel, /accessLevel\s*===\s*['"]admin['"]/);
  assert.match(admin, /<SyncStatusPanel/);
});
