import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import type Database from 'better-sqlite3';
import { Pool } from 'pg';
import { GET as overview } from '../src/app/api/content/route';
import { GET as articles } from '../src/app/api/content/articles/route';
import { GET as exportArticles } from '../src/app/api/content/export/route';
import * as articleQuery from '../src/lib/article-query';

const range = { start: '2026-10-14', end: '2026-10-20' };
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (filename: string) => Pick<Database.Database, 'exec' | 'prepare' | 'close'>;
};

test('content date filters validate complete inclusive publication ranges', () => {
  assert.deepEqual(articleQuery.parseArticleDateRange(new URLSearchParams(range)), range);
  assert.equal(articleQuery.parseArticleDateRange(new URLSearchParams()), undefined);
  for (const params of ['start=2026-10-14', 'end=2026-10-20', 'start=&end=', 'start=2026-02-30&end=2026-03-01', 'start=2026-10-21&end=2026-10-20']) {
    assert.throws(() => articleQuery.parseArticleDateRange(new URLSearchParams(params)), RangeError);
  }
  assert.deepEqual(articleQuery.parseArticleListParams(new URLSearchParams({ platform: 'csdn', ...range })).range, range);
});

test('seven-day overview, list and CSV include five published articles and their current 150 reads', async t => {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE article_details (
    id INTEGER PRIMARY KEY, platform TEXT, date TEXT, published_date TEXT, article_title TEXT,
    article_url TEXT, views INTEGER, updated_at TEXT, content_category TEXT, content_source TEXT
  )`);
  const insert = database.prepare('INSERT INTO article_details VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const [id, date, publishedDate, views] of [
    [1, '2026-10-20', '2026-10-14', 10],
    [2, '2026-09-01', '2026-10-15', 20],
    [3, '2026-10-16', null, 30],
    [4, '2026-10-19', '', 40],
    [5, '2026-10-20', '2026-10-20', 50],
    [6, '2026-10-20', '2026-09-01', 10000],
    [7, '2026-10-13', null, 100],
    [8, '2026-10-21', null, 200],
  ] as const) insert.run(id, 'csdn', date, publishedDate, `article-${id}`, `https://example.com/${id}`, views, '2026-10-22T01:00:00Z', '', '');
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values: unknown[] = []) => {
    // Execute the production SELECT against a local fixture; only Postgres casts/bindings differ.
    const portableSql = sql.replace(/::(?:integer|bigint)/g, '').replace(/\$\d+/g, '?');
    return { rows: database.prepare(portableSql).all(...values as (string | number)[]) };
  });
  try {
    const suffix = new URLSearchParams(range);
    const summaryResponse = await overview(new Request(`http://localhost/api/content?${suffix}`));
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.platforms.find((row: { platform: string }) => row.platform === 'csdn').article_count, 5);
    assert.equal(summary.platforms.find((row: { platform: string }) => row.platform === 'csdn').total_views, 150);
    assert.equal(summary.platforms.find((row: { platform: string }) => row.platform === 'wechat').article_count, 0);
    const listResponse = await articles(new Request(`http://localhost/api/content/articles?platform=csdn&${suffix}`));
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.total, 5);
    assert.equal(list.items.reduce((sum: number, row: { views: number }) => sum + row.views, 0), 150);
    assert.deepEqual(list.items.map((row: { id: number }) => row.id).sort(), [1, 2, 3, 4, 5]);
    const csvResponse = await exportArticles(new Request(`http://localhost/api/content/export?platform=csdn&${suffix}`));
    assert.equal(csvResponse.status, 200);
    const csv = await csvResponse.text();
    assert.equal(csv.trim().split('\n').length, 6);
    assert.ok(csv.includes('"csdn","2026-10-15","article-2"'));
    assert.equal(csv.includes('article-6'), false);
    const allResponse = await overview(new Request('http://localhost/api/content'));
    assert.equal((await allResponse.json()).platforms.find((row: { platform: string }) => row.platform === 'csdn').article_count, 8);
  } finally {
    database.close();
  }
});

test('all content endpoints reject incomplete or reversed dates before querying the database', async t => {
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  const query = t.mock.method(Pool.prototype, 'query', async () => { throw new Error('Invalid range must not query'); });
  for (const handler of [overview, articles, exportArticles]) {
    const response = await handler(new Request('http://localhost/api/content?platform=csdn&start=2026-10-21&end=2026-10-20'));
    assert.equal(response.status, 400);
  }
  assert.equal(query.mock.callCount(), 0);
});
