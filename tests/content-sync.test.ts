import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMetric,
  parseJuejinResponse,
  parseModbArticle,
  parseSegmentFaultArticle,
  prepareRecentArticles,
} from '../src/lib/content-sync';
import { persistSyncedArticles } from '../src/lib/article-sync';

test('normalizes localized article metrics', () => {
  assert.equal(normalizeMetric('1,234'), 1234);
  assert.equal(normalizeMetric('1.2万'), 12000);
  assert.equal(normalizeMetric('3.4k'), 3400);
  assert.equal(normalizeMetric(undefined), undefined);
});

test('keeps at most 50 unique articles with valid URLs', () => {
  const articles = Array.from({ length: 55 }, (_, index) => ({
    title: `Article ${index}`,
    url: `https://example.com/${index}`,
    date: '2026-10-12',
    views: index,
  }));

  articles.splice(1, 0, { ...articles[0], views: 999 });
  articles.splice(2, 0, { ...articles[1], url: '' });

  const prepared = prepareRecentArticles(articles);

  assert.equal(prepared.length, 50);
  assert.equal(prepared[0].views, 0);
  assert.equal(new Set(prepared.map(article => article.url)).size, 50);
});

test('parses Juejin API results with real reading metrics', () => {
  const articles = parseJuejinResponse({
    data: [
      {
        article_id: '123',
        article_info: {
          title: 'IvorySQL article',
          ctime: '1791763200',
          view_count: 321,
          digg_count: 12,
          comment_count: 4,
        },
      },
    ],
    cursor: '10',
    has_more: true,
  });

  assert.deepEqual(articles.articles, [
    {
      title: 'IvorySQL article',
      url: 'https://juejin.cn/post/123',
      date: '2026-10-12',
      views: 321,
      likes: 12,
      comments: 4,
    },
  ]);
  assert.equal(articles.cursor, '10');
  assert.equal(articles.hasMore, true);
});

test('parses SegmentFault article metadata and reading count', () => {
  const html = `
    <h1><a class="link-dark">PostgreSQL 日报</a></h1>
    <time dateTime="2026-09-30T08:01:39.000Z"></time>
    <div><span>阅读 <!-- -->396</span></div>
  `;

  assert.deepEqual(parseSegmentFaultArticle(html, 'https://segmentfault.com/a/1'), {
    title: 'PostgreSQL 日报',
    url: 'https://segmentfault.com/a/1',
    date: '2026-09-30',
    views: 396,
  });
});

test('parses article metrics embedded in Modb Nuxt state', () => {
  const html = 'title:"IvorySQL 5.4",createdTime:"2026-09-30 11:31:38",views:103,likes:5,commentCount:2';

  assert.deepEqual(parseModbArticle(html, 'https://www.modb.pro/db/1'), {
    title: 'IvorySQL 5.4',
    url: 'https://www.modb.pro/db/1',
    date: '2026-09-30',
    views: 103,
    likes: 5,
    comments: 2,
  });
});

test('persists one batch, recalculates affected dates, and marks the platform updated', async () => {
  const saved: string[] = [];
  const recalculated: string[] = [];
  const updated: string[] = [];

  const result = await persistSyncedArticles('juejin', [
    { title: 'A', url: 'https://example.com/a', date: '2026-10-12', views: 10 },
    { title: 'B', url: 'https://example.com/b', date: '2026-10-11', views: 20 },
    { title: 'A duplicate', url: 'https://example.com/a', date: '2026-10-12', views: 30 },
  ], {
    saveBatch: async articles => { saved.push(...articles.map(article => article.article_url)); },
    recalculateBatch: async (_platform, dates) => { recalculated.push(...dates); },
    markUpdated: async platform => { updated.push(platform); },
  });

  assert.deepEqual(saved, ['https://example.com/a', 'https://example.com/b']);
  assert.deepEqual(recalculated.sort(), ['2026-10-11', '2026-10-12']);
  assert.deepEqual(updated, ['juejin']);
  assert.deepEqual(result, { success: true, articles: 2 });
});
