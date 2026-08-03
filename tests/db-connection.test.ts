import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import {
  getDb,
  getLatestContributorStats,
  getLatestGitHubStats,
  saveArticleDetails,
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
    assert.match(initializationQueries.join('\n'), /UNIQUE INDEX[^;]+article_details[^;]+platform[^;]+article_url/is);
  } finally {
    Pool.prototype.connect = originalConnect;
    Pool.prototype.query = originalQuery;
  }
});

test('upserts linked articles by platform and URL', async () => {
  const originalQuery = Pool.prototype.query;
  const queries: string[] = [];

  Pool.prototype.query = async function (sql: string) {
    queries.push(sql);
    return { rows: [] } as never;
  };

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
    Pool.prototype.query = originalQuery;
  }
});

test('keeps the legacy identity for articles without a URL', async () => {
  const originalQuery = Pool.prototype.query;
  const queries: string[] = [];

  Pool.prototype.query = async function (sql: string) {
    queries.push(sql);
    return { rows: [] } as never;
  };

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
    Pool.prototype.query = originalQuery;
  }
});
