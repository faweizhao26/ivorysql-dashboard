import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { Pool } from 'pg';
import {
  getDb,
  getLatestContributorStats,
  getLatestGitHubStats,
  recalculateArticleStatsForDates,
  saveArticleDetails,
  saveSyncedArticleDetails,
  saveSyncedArticleDetailsBatch,
} from '../src/lib/db';

test('limits each serverless instance to one database connection', () => {
  assert.equal(getDb().options.max, 1);
});

test('shares database initialization across concurrent queries', async () => {
  const originalConnect = Pool.prototype.connect;
  const originalQuery = Pool.prototype.query;
  let connectCalls = 0;
  const initializationQueries: string[] = [];
  let finishInitialization!: () => void;
  const initializationGate = new Promise<void>((resolve) => {
    finishInitialization = resolve;
  });

  Pool.prototype.connect = async function () {
    connectCalls += 1;
    await initializationGate;
    return {
      query: async (sql: string) => {
        initializationQueries.push(sql);
        return { rows: [] };
      },
      release: () => undefined,
    } as never;
  };
  Pool.prototype.query = async function () {
    return { rows: [] } as never;
  };

  try {
    const requests = Promise.all([
      getLatestGitHubStats(),
      getLatestContributorStats(),
    ]);

    await Promise.resolve();
    await Promise.resolve();
    finishInitialization();
    await requests;

    assert.equal(connectCalls, 1);
    assert.match(initializationQueries.join('\n'), /DROP CONSTRAINT IF EXISTS unique_article/);
    assert.match(initializationQueries.join('\n'), /UNIQUE INDEX[^;]+article_details[^;]+platform[^;]+article_url/i);
  } finally {
    Pool.prototype.connect = originalConnect;
    Pool.prototype.query = originalQuery;
  }
});

test('upserts linked articles by platform and URL', async () => {
  const queries: string[] = [];

  const queryMock = mock.method(Pool.prototype, 'query', async function (sql: string) {
    queries.push(sql);
    return { rows: [] };
  });

  try {
    await saveArticleDetails({
      date: '2026-08-02',
      platform: 'modb',
      article_title: '同日重名文章',
      article_url: 'https://example.com/article-1',
      views: 10,
      likes: 0,
      comments: 0,
    });

    assert.match(queries.at(-1) || '', /ON CONFLICT \(platform, article_url\)/);
  } finally {
    queryMock.mock.restore();
  }
});

test('keeps the legacy identity for articles without a URL', async () => {
  const queries: string[] = [];

  const queryMock = mock.method(Pool.prototype, 'query', async function (sql: string) {
    queries.push(sql);
    return { rows: [] };
  });

  try {
    await saveArticleDetails({
      date: '2026-08-02',
      platform: 'wechat',
      article_title: '无链接文章',
      views: 10,
      likes: 0,
      comments: 0,
    });

    assert.match(queries.at(-1) || '', /ON CONFLICT \(date, platform, article_title\)/);
  } finally {
    queryMock.mock.restore();
  }
});

test('automatic sync does not replace existing metrics when a source omits them', async () => {
  const queries: string[] = [];

  const queryMock = mock.method(Pool.prototype, 'query', async function (sql: string) {
    queries.push(sql);
    return { rows: [] };
  });

  try {
    await saveSyncedArticleDetails({
      date: '2026-10-12',
      platform: 'sf',
      article_title: '自动同步文章',
      article_url: 'https://example.com/article',
      views: 25,
    });

    const sql = queries.at(-1) || '';
    assert.match(sql, /views = COALESCE\(EXCLUDED\.views, article_details\.views\)/);
    assert.match(sql, /likes = COALESCE\(EXCLUDED\.likes, article_details\.likes\)/);
    assert.match(sql, /comments = COALESCE\(EXCLUDED\.comments, article_details\.comments\)/);
  } finally {
    queryMock.mock.restore();
  }
});

test('automatic sync writes an article collection in one query', async () => {
  const queries: string[] = [];

  const queryMock = mock.method(Pool.prototype, 'query', async function (sql: string) {
    queries.push(sql);
    return { rows: [] };
  });

  try {
    await saveSyncedArticleDetailsBatch([
      {
        date: '2026-10-12',
        platform: 'zhihu',
        article_title: '文章一',
        article_url: 'https://example.com/1',
        views: 25,
      },
      {
        date: '2026-10-11',
        platform: 'zhihu',
        article_title: '文章二',
        article_url: 'https://example.com/2',
      },
    ]);

    const sql = queries.at(-1) || '';
    assert.match(sql, /SELECT \* FROM UNNEST/);
    assert.match(sql, /views = COALESCE\(EXCLUDED\.views, article_details\.views\)/);
    assert.equal(queries.filter(query => /INSERT INTO article_details/.test(query)).length, 1);
  } finally {
    queryMock.mock.restore();
  }
});

test('automatic sync recalculates all affected dates in one query', async () => {
  const queries: string[] = [];

  const queryMock = mock.method(Pool.prototype, 'query', async function (sql: string) {
    queries.push(sql);
    return { rows: [] };
  });

  try {
    await recalculateArticleStatsForDates('zhihu', ['2026-10-11', '2026-10-12']);

    const sql = queries.at(-1) || '';
    assert.match(sql, /date = ANY\(\$2::text\[\]\)/);
    assert.match(sql, /GROUP BY date, platform/);
    assert.equal(queries.filter(query => /INSERT INTO article_stats/.test(query)).length, 1);
  } finally {
    queryMock.mock.restore();
  }
});
