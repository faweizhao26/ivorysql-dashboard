import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { getContributorStatsByDateRange, getContributorStatsHistory, getLatestContributorStats, getContributorStatsForDate } from '../src/lib/db';

test('history and summary-only contributor requests never fetch monthly JSON', async t => {
  const statements: string[] = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async (sql: string) => { statements.push(sql); return { rows: [] }; });
  await getContributorStatsByDateRange('2026-01-01', '2026-10-17');
  await getContributorStatsHistory(365);
  await getLatestContributorStats('2026-10-17', false);
  await getContributorStatsForDate('2026-10-17', false);
  assert.equal(statements.length, 4);
  for (const sql of statements) {
    assert.doesNotMatch(sql, /SELECT \*|main_repo_monthly_activity/);
    assert.match(sql, /new_contributors_daily/);
  }
  statements.length = 0;
  await getLatestContributorStats('2026-10-17', true);
  assert.match(statements[0], /SELECT \*/);
});
