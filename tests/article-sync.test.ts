import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { Pool } from 'pg';
import { persistSyncedArticles } from '../src/lib/article-sync';

interface Query {
  sql: string;
  values?: unknown[];
  transactional: boolean;
}

// Replace the PostgreSQL transport, including initialization: never open a connection.
async function captureSync(
  oldDates: string[],
  operation: () => Promise<unknown>,
  failOn?: RegExp,
) {
  const queries: Query[] = [];
  let inTransaction = false;
  const execute = async (sql: string, values?: unknown[]) => {
    if (sql.trim() === 'BEGIN') inTransaction = true;
    queries.push({ sql: sql.trim(), values, transactional: inTransaction });
    if (failOn?.test(sql)) throw new Error('Injected write failure');
    if (sql.trim() === 'COMMIT' || sql.trim() === 'ROLLBACK') inTransaction = false;
    return { rows: /^\s*SELECT\b[\s\S]*FROM article_details/.test(sql)
      ? oldDates.map(date => ({ date })) : [] };
  };
  const connect = mock.method(Pool.prototype, 'connect', async () => ({
    query: execute,
    release: () => undefined,
  }));
  const query = mock.method(Pool.prototype, 'query', execute);
  try {
    await operation();
    return queries.filter(query => !query.sql.startsWith('CREATE TABLE'));
  } finally {
    connect.mock.restore();
    query.mock.restore();
  }
}

const movedArticle = {
  title: 'Moved article', url: 'https://example.com/moved', date: '2026-10-15', views: 0,
};

test('default sync reads old URL dates before moving details and rebuilds the date union', async () => {
  const queries = await captureSync(['2026-10-12', '2026-10-12'], () =>
    persistSyncedArticles('itpub', [movedArticle]));
  const lookupIndex = queries.findIndex(query => /SELECT date FROM article_details/.test(query.sql));
  const saveIndex = queries.findIndex(query => /INSERT INTO article_details/.test(query.sql));
  const lockIndex = queries.findIndex(query => /pg_advisory_xact_lock/.test(query.sql));
  assert.ok(lockIndex > 0 && lockIndex < lookupIndex, 'same-platform syncs must serialize before reading old dates');
  assert.ok(lookupIndex >= 0 && lookupIndex < saveIndex, 'old dates must be captured before upsert');
  const lookup = queries[lookupIndex];
  assert.match(lookup.sql, /platform = \$1/);
  assert.match(lookup.sql, /article_url = ANY\(\$2::text\[\]\)/);
  assert.deepEqual(lookup.values, ['itpub', ['https://example.com/moved']]);
  const aggregate = queries.find(query => /INSERT INTO article_stats/.test(query.sql))!;
  assert.deepEqual((aggregate.values?.[1] as string[]).sort(), ['2026-10-12', '2026-10-15']);
  assert.equal(aggregate.values?.[0], 'itpub');
  assert.match(aggregate.sql, /GROUP BY date, platform/);
  const save = queries[saveIndex];
  assert.deepEqual(save.values?.slice(4), [[0], [null], [null]]);
  for (const field of ['views', 'likes', 'comments']) {
    assert.ok(save.sql.includes(`${field} = COALESCE(EXCLUDED.${field}, article_details.${field})`));
  }
  assert.equal(queries[0].sql, 'BEGIN');
  assert.equal(queries.at(-1)?.sql, 'COMMIT');
  assert.ok(queries.slice(0, -1).every(query => query.transactional));
  assert.match(queries.at(-2)!.sql, /UPDATE reminder_settings/);
});

test('empty old dates are cleaned only within this input and retain followers and bookmarks', async () => {
  const queries = await captureSync(['2026-10-12'], () =>
    persistSyncedArticles('itpub', [movedArticle]));
  const cleanup = queries.filter(query => /^(DELETE FROM|UPDATE) article_stats\b/.test(query.sql));
  assert.equal(cleanup.length, 2, 'delete empty summaries and reset metadata-only summaries');
  for (const query of cleanup) {
    assert.deepEqual(query.values, ['itpub', ['2026-10-12']]);
    assert.match(query.sql, /platform = \$1/);
    assert.match(query.sql, /date = ANY\(\$2::text\[\]\)/);
    assert.match(query.sql, /NOT EXISTS[\s\S]*article_details/);
    assert.match(query.sql, /\w+\.date = \w+\.date/);
    assert.match(query.sql, /\w+\.platform = \w+\.platform/);
  }
  const deletion = cleanup.find(query => query.sql.startsWith('DELETE'))!;
  assert.match(deletion.sql, /COALESCE\(\w+\.followers, 0\) = 0/);
  assert.match(deletion.sql, /COALESCE\(\w+\.bookmarks, 0\) = 0/);
  const reset = cleanup.find(query => query.sql.startsWith('UPDATE'))!;
  for (const field of ['article_count', 'total_views', 'avg_views', 'likes', 'comments', 'new_articles']) {
    assert.ok(reset.sql.includes(`${field} = 0`));
  }
  assert.doesNotMatch(reset.sql, /(?:followers|bookmarks)\s*=/);
  const aggregate = queries.find(query => /INSERT INTO article_stats/.test(query.sql))!;
  assert.match(aggregate.sql, /bookmarks = article_stats.bookmarks/);
  assert.match(aggregate.sql, /followers = article_stats.followers/);
});

test('a new URL does not clean unrelated dates containing manual summaries', async () => {
  const queries = await captureSync([], () => persistSyncedArticles('itpub', [movedArticle]));
  assert.equal(queries.some(query => /^(DELETE FROM|UPDATE) article_stats\b/.test(query.sql)), false);
});

for (const failure of [/INSERT INTO article_details/, /INSERT INTO article_stats/, /DELETE FROM article_stats/, /UPDATE article_stats/, /UPDATE reminder_settings/]) {
  test(`rolls back the whole default sync when ${failure.source} fails`, async () => {
    const queries = await captureSync(['2026-10-12'], async () => {
      await assert.rejects(persistSyncedArticles('itpub', [movedArticle]), /Injected write failure/);
    }, failure);
    assert.equal(queries[0].sql, 'BEGIN');
    assert.equal(queries.at(-1)?.sql, 'ROLLBACK');
    assert.equal(queries.some(query => query.sql === 'COMMIT'), false);
    assert.ok(queries.every(query => query.transactional));
  });
}

test('invalid input is rejected before starting any transaction', async () => {
  const queries = await captureSync([], async () => {
    await assert.rejects(persistSyncedArticles('itpub', []), /No valid/);
    await assert.rejects(persistSyncedArticles('itpub', [{ ...movedArticle, date: 'invalid' }]), /Invalid publication date/);
  });
  assert.deepEqual(queries, []);
});
