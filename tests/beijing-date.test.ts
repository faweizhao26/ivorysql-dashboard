import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Pool } from 'pg';
import * as db from '../src/lib/db';
import { newEvent } from '../src/components/events/EventForm';
import { aggregateMonthlyContributorActivity, isCurrentContributionMonth } from '../src/lib/contributor-activity';
import { getBeijingDate, shiftDate } from '../src/lib/date';
import { GET as getDashboard } from '../src/app/api/dashboard/route';
import { GET as getSocial } from '../src/app/api/social/route';
import { GET as getArticles } from '../src/app/api/articles/route';

function freeze(t: TestContext, instant: string) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(instant) });
}

function captureQueries(t: TestContext) {
  const queries: { sql: string; values: unknown[] }[] = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({
    query: async () => ({ rows: [] }), release() {},
  }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values: unknown[] = []) => {
    queries.push({ sql, values });
    return { rows: [] };
  });
  return queries;
}

for (const [instant, expected] of [
  ['2026-10-16T15:59:59.999Z', '2026-10-16'],
  ['2026-10-16T16:00:00.000Z', '2026-10-17'],
  ['2026-10-16T23:59:59.999Z', '2026-10-17'],
  ['2026-10-17T00:00:00.000Z', '2026-10-17'],
  ['2026-10-31T16:00:00.000Z', '2026-11-01'],
  ['2026-12-31T16:00:00.000Z', '2027-01-01'],
]) {
  test(`defaults to Beijing date ${expected} at ${instant}`, (t) => {
    freeze(t, instant);
    assert.equal(db.getToday(), expected);
    assert.equal(newEvent().event_date, expected);
    assert.equal(isCurrentContributionMonth(expected.slice(0, 7)), true);
  });
}

test('current month switches at Beijing midnight', () => {
  const now = new Date('2026-12-31T16:00:00Z');
  assert.equal(isCurrentContributionMonth('2027-01', now), true);
  assert.equal(isCurrentContributionMonth('2026-12', now), false);
});

test('historical GitHub events retain their UTC month at the Beijing year boundary', () => {
  const months = aggregateMonthlyContributorActivity([
    { number: 1, type: 'issue', author: 'alice', created_at: '2026-12-31T16:00:00Z', status: 'open' },
    { number: 2, type: 'pr', author: 'bob', created_at: '2026-12-01T00:00:00Z', merged_at: '2026-12-31T23:59:59Z', status: 'merged' },
  ], 2026);
  assert.deepEqual(months.map(month => month.month), ['2026-12']);
  assert.equal(months[0].contributor_count, 2);
});

test('date helpers preserve calendar arithmetic across leap days and reject invalid instants', () => {
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDate('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2026-11-01', 0), '2026-11-01');
  assert.throws(() => getBeijingDate(new Date('invalid')), RangeError);
});

test('relative database queries subtract calendar days from Beijing today', async (t) => {
  freeze(t, '2026-12-31T16:00:00Z');
  const queries = captureQueries(t);
  await db.getGitHubStatsHistory(7);
  await db.getContributorStatsHistory(7);
  await db.getSocialStatsByPlatform('wechat', 7);
  await db.getArticleStatsByPlatform('wechat', 7);
  await db.getRecentEvents(7, 20);
  await db.getManualData(undefined, 7);
  await db.getManualData('social', 7);
  await db.getDownloadStatsHistory(7);
  await db.getArticleDetailsByPlatform('wechat', 7);
  await db.getActivityEvents(7);
  assert.equal(queries.length, 10);
  for (const query of queries) {
    assert.ok(query.values.includes('2026-12-25'), query.sql);
  }
});

for (const [name, handler] of [
  ['dashboard', getDashboard], ['social', getSocial],
] as const) {
  test(`${name} API defaults its date range to Beijing today`, async (t) => {
    freeze(t, '2026-10-31T16:00:00Z');
    const queries = captureQueries(t);
    const response = await handler(new Request(`http://localhost/api/${name}?platform=wechat`));
    assert.equal(response.status, 200);
    assert.ok(queries.some(query => query.values.includes('2026-11-01')));
    assert.ok(queries.every(query => !query.values.includes('2026-10-31')));
  });
}

test('explicit database date ranges remain inclusive and unchanged', async (t) => {
  const queries = captureQueries(t);
  await db.getGitHubStatsByDateRange('2025-12-31', '2026-01-01');
  await db.getArticleStatsByDateRange('2025-12-31', '2026-01-01');
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.deepEqual(query.values, ['2025-12-31', '2026-01-01']);
    assert.match(query.sql, /date >= \$1 AND date <= \$2/);
  }
});

test('article API derives the default start from the requested end, not the current clock', async (t) => {
  freeze(t, '2026-10-31T16:00:00Z');
  captureQueries(t);
  t.mock.method(Pool.prototype, 'query', async (sql: string) => ({
    rows: sql.includes('FROM article_details') ? [
      { date: '2025-12-02', platform: 'wechat', article_title: 'start' },
      { date: '2026-01-01', platform: 'wechat', article_title: 'end' },
      { date: '2025-12-01', platform: 'wechat', article_title: 'before' },
      { date: '2026-01-02', platform: 'wechat', article_title: 'after' },
    ] : [],
  }));
  const response = await getArticles(new Request('http://localhost/api/articles?platform=wechat&end=2026-01-01&days=30'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.data.map((row: { date: string }) => row.date), ['2025-12-02', '2026-01-01']);
});

test('article API includes Beijing today by default', async (t) => {
  freeze(t, '2026-10-31T16:00:00Z');
  captureQueries(t);
  t.mock.method(Pool.prototype, 'query', async () => ({
    rows: [{ date: '2026-11-01', platform: 'wechat', article_title: 'today' }],
  }));
  const response = await getArticles(new Request('http://localhost/api/articles?platform=wechat'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.length, 1);
});
