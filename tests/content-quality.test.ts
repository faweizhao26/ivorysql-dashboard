import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import type Database from 'better-sqlite3';
import { Pool } from 'pg';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { getArticlePlatformSummaries } from '../src/lib/db';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (filename: string) => Pick<Database.Database, 'exec' | 'prepare' | 'close'> };

test('publication summaries distinguish missing reads, partial known zero and complete zero', async t => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE article_details (platform TEXT, date TEXT, published_date TEXT, views INTEGER, updated_at TEXT);");
  const insert = db.prepare('INSERT INTO article_details VALUES (?, ?, NULL, ?, ?)');
  for (const [platform, views] of [['csdn', null], ['csdn', null], ['sf', 0], ['sf', null], ['itpub', 0]] as const) insert.run(platform, '2026-10-20', views, '2026-10-26T01:00:00Z');
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values: unknown[] = []) => ({ rows: db.prepare(sql.replace(/::(?:integer|bigint)/g, '').replace(/\$\d+/g, '?')).all(...values as (string | number)[]) }));
  try {
    const summaries = await getArticlePlatformSummaries({ start: '2026-10-20', end: '2026-10-20' });
    const missing = summaries.find(row => row.platform === 'csdn')!;
    assert.equal(missing.total_views, null);
    assert.equal(missing.missing_views, 2);
    assert.equal(missing.measured_articles, 0);
    assert.equal(summaries.find(row => row.platform === 'sf')!.total_views, 0);
    assert.equal(summaries.find(row => row.platform === 'sf')!.missing_views, 1);
    assert.equal(summaries.find(row => row.platform === 'itpub')!.missing_views, 0);
  } finally { db.close(); }
});

test('cards, client parsing and exports keep missing and partial metrics explicit', async () => {
  const { fetchContentOverview, contentOverviewExportRows } = await import('../src/lib/content-overview');
  const { ContentPlatformCards } = await import('../src/components/ContentPlatformCards');
  const rows = [{ platform: 'csdn', article_count: 2, total_views: null, missing_views: 2, measured_articles: 0, data_date: null, updated_at: null }, { platform: 'sf', article_count: 2, total_views: 0, missing_views: 1, measured_articles: 1, data_date: null, updated_at: null }];
  const result = await fetchContentOverview(undefined, async () => Response.json({ platforms: rows, updated_at: null }));
  assert.equal(result.platforms[0].total_views, null);
  const html = load(renderToStaticMarkup(createElement(ContentPlatformCards, { summaries: rows })));
  assert.equal(html('[data-content-platform="csdn"] dd').last().text(), '-');
  assert.match(html('[data-content-platform="csdn"]').text(), /2 篇未获取阅读量/);
  assert.match(html('[data-content-platform="sf"]').text(), /1 篇未获取阅读量/);
  const exported = contentOverviewExportRows(rows);
  assert.equal(exported[0].阅读量, '');
  assert.equal(exported[0].阅读量缺失篇数, 2);
});

test('platform collection freshness is independent of article edit times and respects manual and archived sources', async () => {
  const { contentSyncState } = await import('../src/lib/content-overview');
  const now = Date.parse('2026-10-26T01:00:00Z');
  assert.equal(contentSyncState('wechat', null, now).label, '手动更新');
  assert.equal(contentSyncState('juejin', null, now).label, '历史保留');
  assert.equal(contentSyncState('csdn', { status: 'success', last_success_at: '2026-10-19T01:00:00Z', last_attempt_at: '2026-10-19T01:00:00Z' }, now).label, '采集已过期');
  assert.equal(contentSyncState('csdn', { status: 'failed', last_success_at: '2026-10-25T01:00:00Z', last_attempt_at: '2026-10-26T00:00:00Z' }, now).label, '最近采集失败');
  assert.equal(contentSyncState('csdn', { status: 'running', last_success_at: null, last_attempt_at: '2026-10-26T00:00:00Z' }, now).label, '采集可能中断');
  assert.equal(contentSyncState('itpub', { status: 'success', last_success_at: '2026-10-20T01:00:00Z', last_attempt_at: '2026-10-20T01:00:00Z' }, now).label, '采集正常');
});

test('cancelled browser collectors ignore historical results and unavailable sync logs', async () => {
  const { contentSyncState } = await import('../src/lib/content-overview');
  const now = Date.parse('2026-11-01T01:00:00Z');
  for (const platform of ['oschina', 'ctoutiao', 'toutiao', 'zhihu']) {
    for (const status of ['success', 'failed', 'running'] as const) {
      const sync = { status, last_success_at: '2026-10-01T01:00:00Z', last_attempt_at: '2026-10-01T01:00:00Z' };
      for (const unavailable of [false, true]) {
        assert.deepEqual(contentSyncState(platform, sync, now, unavailable), { label: '手动更新', tone: 'muted' });
      }
    }
    assert.equal(contentSyncState(platform, null, now).label, '手动更新');
  }
});

test('content date filter offers independent range selection and preserves platform query state', async () => {
  const { ContentDateFilter } = await import('../src/components/ContentDateFilter');
  const { publicationRangeQuery } = await import('../src/lib/content-overview');
  const query = publicationRangeQuery(new URLSearchParams('platform=zhihu&start=2026-10-01&end=2026-10-02'), { start: '2026-10-20', end: '2026-10-26' });
  assert.equal(query.get('platform'), 'zhihu');
  assert.equal(query.get('start'), '2026-10-20');
  assert.equal(publicationRangeQuery(query).has('start'), false);
  const html = load(renderToStaticMarkup(createElement(ContentDateFilter, { onChange() {} })));
  assert.equal(html('input[type="date"]').length, 2);
  assert.ok(html('select').text().includes('最近 7 天'));
});
