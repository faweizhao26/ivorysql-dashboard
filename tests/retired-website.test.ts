import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { Pool } from 'pg';
import { getDashboardUpdatedAt } from '../src/lib/db';

test('retired website traffic has no page, API, navigation or sample writes', () => {
  const file = (path: string) => new URL(`../${path}`, import.meta.url);
  assert.equal(existsSync(file('src/app/website/page.tsx')), false);
  assert.equal(existsSync(file('src/app/api/website/route.ts')), false);
  assert.doesNotMatch(readFileSync(file('src/components/NavLinks.tsx'), 'utf8'), /\/website/);
  assert.doesNotMatch(readFileSync(file('src/lib/seed.ts'), 'utf8'), /saveWebsiteStats/);
});

test('retired traffic records cannot affect dashboard freshness', async t => {
  const queries: string[] = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async (sql: string) => {
    queries.push(sql);
    return { rows: [{ updated_at: '2026-10-17T01:00:00Z' }] };
  });
  assert.equal(await getDashboardUpdatedAt(), '2026-10-17T01:00:00Z');
  assert.ok(queries.some(sql => sql.includes('FROM github_stats')));
  assert.ok(queries.every(sql => !sql.includes('FROM website_stats')));
});
