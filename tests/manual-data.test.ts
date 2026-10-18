import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Pool } from 'pg';
import { GET, POST } from '../src/app/api/manual/route';

const validEntry = {
  date: '2026-10-17', category: 'social', platform: 'wechat', metric: 'followers', value: 42,
};

function databaseBoundary(t: TestContext, rows: unknown[] = [], fail = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({
    query: async () => ({ rows: [] }), release() {},
  }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (fail) throw new Error('database unavailable');
    return { rows, rowCount: 1 };
  });
  return calls;
}

function post(body: unknown) {
  return POST(new Request('http://localhost/api/manual', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

for (const [label, payload] of [
  ['null body', null],
  ['array body', []],
  ['string body', 'entry'],
  ['missing date', { ...validEntry, date: undefined }],
  ['non-padded date', { ...validEntry, date: '2026-2-03' }],
  ['impossible day', { ...validEntry, date: '2026-02-30' }],
  ['non-leap day', { ...validEntry, date: '2026-02-29' }],
  ['zero year', { ...validEntry, date: '0000-01-01' }],
  ['timestamp instead of date', { ...validEntry, date: '2026-10-17T00:00:00Z' }],
  ['missing category', { ...validEntry, category: undefined }],
  ['unknown category', { ...validEntry, category: 'website' }],
  ['prototype category', { ...validEntry, category: '__proto__' }],
  ['missing social platform', { ...validEntry, platform: undefined }],
  ['wrong social platform', { ...validEntry, platform: 'csdn' }],
  ['wrong article platform', { ...validEntry, category: 'article', platform: 'youtube' }],
  ['missing activity platform', { ...validEntry, category: 'activity', platform: undefined, metric: 'participants' }],
  ['wrong activity platform', { ...validEntry, category: 'activity', metric: 'participants' }],
  ['wrong metric', { ...validEntry, metric: 'article_count' }],
  ['wrong article metric', { ...validEntry, category: 'article', platform: 'csdn', metric: 'posts' }],
  ['injected column', { ...validEntry, metric: 'likes = 0; DROP TABLE social_stats; --' }],
  ['missing value', { ...validEntry, value: undefined }],
  ['null value', { ...validEntry, value: null }],
  ['numeric string', { ...validEntry, value: '42' }],
  ['boolean value', { ...validEntry, value: true }],
  ['negative value', { ...validEntry, value: -1 }],
  ['fractional value', { ...validEntry, value: 1.5 }],
  ['unsafe integer', { ...validEntry, value: Number.MAX_SAFE_INTEGER + 1 }],
  ['social integer overflow', { ...validEntry, value: 2147483648 }],
  ['article integer overflow', { ...validEntry, category: 'article', platform: 'csdn', value: 2147483648 }],
  ['object notes', { ...validEntry, notes: {} }],
  ['NUL notes', { ...validEntry, notes: 'bad\0notes' }],
] as const) {
  test(`manual POST rejects ${label} before querying`, async t => {
    const calls = databaseBoundary(t);
    t.mock.method(console, 'error', () => {});
    const response = await post(payload);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
    assert.deepEqual(calls, []);
  });
}

test('manual POST rejects malformed JSON without querying', async t => {
  const calls = databaseBoundary(t);
  t.mock.method(console, 'error', () => {});
  const response = await POST(new Request('http://localhost/api/manual', { method: 'POST', body: '{' }));
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});

for (const [category, platform, metric, value] of [
  ['social', 'wechat', 'followers', 0],
  ['social', 'youtube', 'subscribers', 2147483647],
  ['social', 'bilibili', 'video_views', 12],
  ['article', 'csdn', 'total_views', 100],
  ['article', 'zhihu', 'comments', 4],
  ['article', 'cnblogs', 'bookmarks', 6],
  ['article', 'wechat', 'article_count', 8],
] as const) {
  test(`manual ${category}/${platform}/${metric} emits one allowlisted-column upsert`, async t => {
    // Previously a read followed by an all-column write replaced unknown values with zero.
    const calls = databaseBoundary(t, [{ platform, likes: null, views: 987, followers: 321 }]);
    const response = await post({ ...validEntry, date: '2024-02-29', category, platform, metric, value });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(calls.length, 1, 'no read-modify-write or companion writes');
    assert.equal(calls[0].sql.replace(/\s+/g, ' ').trim(),
      `INSERT INTO ${category}_stats (date, platform, ${metric}) VALUES ($1, $2, $3) ON CONFLICT (date, platform) DO UPDATE SET ${metric} = EXCLUDED.${metric}, updated_at = CURRENT_TIMESTAMP`);
    assert.deepEqual(calls[0].values, ['2024-02-29', platform, value]);
  });
}

for (const [category, platform, secondMetric] of [
  ['social', 'wechat', 'views'], ['article', 'csdn', 'total_views'],
] as const) {
  test(`concurrent ${category} metrics never write each other's columns`, async t => {
    const calls = databaseBoundary(t, [{ platform, followers: 11, [secondMetric]: 22, likes: null }]);
    const responses = await Promise.all([
      post({ ...validEntry, category, platform, value: 123 }),
      post({ ...validEntry, category, platform, metric: secondMetric, value: 456 }),
    ]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    assert.equal(calls.length, 2, 'exactly one atomic statement per request');
    for (const [index, metric] of ['followers', secondMetric].entries()) {
      const sql = calls[index].sql.replace(/\s+/g, ' ').trim();
      assert.equal(sql.split('DO UPDATE SET ')[1], `${metric} = EXCLUDED.${metric}, updated_at = CURRENT_TIMESTAMP`);
      assert.deepEqual(calls[index].values, ['2026-10-17', platform, index === 0 ? 123 : 456]);
    }
  });
}

test('activity entries retain the manual_data table, platform prefix and notes', async t => {
  const calls = databaseBoundary(t);
  const response = await post({
    ...validEntry, category: 'activity', platform: 'meetup', metric: 'participants', value: 25,
    notes: "Keep 'quoted' notes unchanged",
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql.replace(/\s+/g, ' ').trim(),
    'INSERT INTO manual_data (date, category, metric, value, notes) VALUES ($1, $2, $3, $4, $5)');
  assert.deepEqual(calls[0].values,
    ['2026-10-17', 'activity', 'meetup_participants', 25, "Keep 'quoted' notes unchanged"]);
});

test('database errors remain generic server errors', async t => {
  databaseBoundary(t, [], true);
  t.mock.method(console, 'error', () => {});
  const response = await post(validEntry);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to save data' });
});

for (const query of ['category=unknown', 'category=__proto__', 'days=0', 'days=-1', 'days=1.5', 'days=10abc', 'days=3651', 'days=Infinity', 'days=']) {
  test(`manual GET rejects invalid query ${query}`, async t => {
    const calls = databaseBoundary(t);
    const response = await GET(new Request(`http://localhost/api/manual?${query}`));
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  });
}

test('manual GET retains valid category filtering and raw manual records', async t => {
  const rows = [{ date: '2026-10-17', category: 'activity', metric: 'meetup_participants', value: 25 }];
  const calls = databaseBoundary(t, rows);
  const response = await GET(new Request('http://localhost/api/manual?category=activity&days=30'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), rows);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values?.[0], 'activity');
});
