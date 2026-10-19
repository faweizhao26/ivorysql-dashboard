import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { Pool } from 'pg';
import { POST, PUT, DELETE, parseArticleDetailsInput } from '../src/app/api/articles/route';

const article = { id: 1, date: '2026-10-10', platform: 'wechat', article_title: 'IvorySQL', article_url: 'https://example.com/article', views: 10, likes: 2, comments: 1 };
type RecordedQuery = { sql: string; values?: unknown[]; transactional: boolean };

async function capture(operation: () => Promise<Response>, options: { failOn?: RegExp; missing?: boolean; empty?: boolean } = {}) {
  const queries: RecordedQuery[] = [];
  let transactional = false;
  const execute = async (sql: string, values?: unknown[]) => {
    sql = sql.trim();
    if (sql === 'BEGIN') transactional = true;
    if (!sql.startsWith('CREATE TABLE')) queries.push({ sql, values, transactional });
    if (options.failOn?.test(sql)) throw new Error('Injected write failure');
    if (sql === 'COMMIT' || sql === 'ROLLBACK') transactional = false;
    if (/SELECT[\s\S]*FROM article_details/.test(sql)) {
      return { rows: options.missing || options.empty && !/WHERE id/.test(sql) ? [] : [article] };
    }
    return { rows: [] };
  };
  const connect = mock.method(Pool.prototype, 'connect', async () => ({ query: execute, release: () => {} }));
  const query = mock.method(Pool.prototype, 'query', execute);
  const errors = mock.method(console, 'error', () => {});
  try { return { response: await operation(), queries }; }
  finally { connect.mock.restore(); query.mock.restore(); errors.mock.restore(); }
}

function request(method: string, body: unknown) {
  return new Request('http://localhost/api/articles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('manual article validation accepts zero and integer strings without losing source fields', () => {
  const parsed = parseArticleDetailsInput({ ...article, views: '0', likes: '12', content_source: '社区' });
  assert.equal(parsed.views, 0);
  assert.equal(parsed.likes, 12);
  assert.equal(parsed.content_source, '社区');
});

for (const invalid of [
  { date: '2026-02-30' }, { date: '0000-01-01' }, { platform: 'unknown' },
  { article_title: '   ' }, { article_url: 'javascript:alert(1)' },
  { views: -1 }, { views: 1.5 }, { views: 'no views' }, { views: '' },
  { views: true }, { views: '12abc' }, { views: 2147483648 }, { content_source: 12 },
]) {
  test(`rejects invalid manual article before database access: ${JSON.stringify(invalid)}`, async () => {
    for (const method of ['POST', 'PUT'] as const) {
      const { response, queries } = await capture(() => ({ POST, PUT })[method](request(method, { ...article, ...invalid })));
      assert.equal(response.status, 400);
      assert.deepEqual(queries, []);
    }
  });
}

test('a malformed article JSON body is a client error', async () => {
  const { response, queries } = await capture(() => POST(new Request('http://localhost/api/articles', { method: 'POST', body: '{' })));
  assert.equal(response.status, 400);
  assert.deepEqual(queries, []);
});

test('upsert rebuilds old and new dates inside one transaction and shares automatic sync locks', async () => {
  const { response, queries } = await capture(() => POST(request('POST', { ...article, date: '2026-10-19' })));
  assert.equal(response.status, 200);
  assert.equal(queries[0].sql, 'BEGIN');
  assert.equal(queries.at(-1)?.sql, 'COMMIT');
  assert.ok(queries.slice(0, -1).every(query => query.transactional));
  const lookup = queries.findIndex(query => /SELECT[\s\S]*FROM article_details/.test(query.sql));
  const lock = queries.findIndex(query => /pg_advisory_xact_lock/.test(query.sql));
  assert.ok(lock >= 0 && lock < lookup);
  assert.ok(queries.some(query => query.values?.includes('article-sync:wechat')));
  const aggregateDates = queries.filter(query => /INSERT INTO article_stats/.test(query.sql)).map(query => query.values?.[0]);
  assert.deepEqual(aggregateDates.sort(), ['2026-10-10', '2026-10-19']);
  assert.match(queries.at(-2)!.sql, /UPDATE reminder_settings/);
});

test('partial edits retain missing and unknown metrics and recompute the effective date', async () => {
  const { response, queries } = await capture(() => PUT(request('PUT', { id: 1, article_title: 'Changed', views: null })));
  assert.equal(response.status, 200);
  const update = queries.find(query => /^UPDATE article_details/.test(query.sql))!;
  assert.ok(update);
  assert.doesNotMatch(update.sql, /(?:views|likes|comments)\s*=/);
  const aggregate = queries.find(query => /INSERT INTO article_stats/.test(query.sql))!;
  assert.deepEqual(aggregate.values?.slice(0, 2), ['2026-10-10', 'wechat']);
});

test('moving an article serializes both platforms in stable order and refreshes both reminders', async () => {
  const { response, queries } = await capture(() => PUT(request('PUT', { id: 1, platform: 'csdn', date: '2026-10-19' })));
  assert.equal(response.status, 200);
  const locks = queries.filter(query => /pg_advisory_xact_lock/.test(query.sql) && String(query.values?.[0]).startsWith('article-sync:'));
  assert.deepEqual(locks.map(query => query.values?.[0]), ['article-sync:csdn', 'article-sync:wechat']);
  const dates = queries.filter(query => /INSERT INTO article_stats/.test(query.sql)).map(query => query.values?.slice(0, 2));
  assert.deepEqual(dates, [['2026-10-19', 'csdn'], ['2026-10-10', 'wechat']]);
  assert.deepEqual(queries.filter(query => /UPDATE reminder_settings/.test(query.sql)).map(query => query.values?.[0]).sort(), ['csdn', 'wechat']);
});

test('deleting the last article retains independent followers and bookmarks while clearing derived counters', async () => {
  const { response, queries } = await capture(() => DELETE(new Request('http://localhost/api/articles?id=1')), { empty: true });
  assert.equal(response.status, 200);
  assert.equal(queries[0].sql, 'BEGIN');
  const cleanup = queries.find(query => /^DELETE FROM article_stats/.test(query.sql))!;
  assert.match(cleanup.sql, /COALESCE\(followers, 0\) = 0/);
  assert.match(cleanup.sql, /COALESCE\(bookmarks, 0\) = 0/);
  const reset = queries.find(query => /^UPDATE article_stats/.test(query.sql))!;
  assert.ok(reset);
  assert.doesNotMatch(reset.sql, /(?:followers|bookmarks)\s*=/);
  assert.equal(queries.filter(query => /^DELETE FROM article_details/.test(query.sql)).length, 1);
  assert.equal(queries.filter(query => /SELECT \* FROM article_details WHERE platform/.test(query.sql)).length, 1);
  assert.equal(queries.at(-1)?.sql, 'COMMIT');
});

for (const method of ['POST', 'PUT', 'DELETE'] as const) {
  for (const failOn of [/INSERT INTO article_stats/, /UPDATE reminder_settings/]) {
    test(`${method} rolls back all changes when ${failOn.source} fails`, async () => {
      const operation = method === 'DELETE' ? () => DELETE(new Request('http://localhost/api/articles?id=1'))
        : () => ({ POST, PUT })[method](request(method, article));
      const { response, queries } = await capture(operation, { failOn });
      assert.equal(response.status, 500);
      assert.equal(queries[0].sql, 'BEGIN');
      assert.equal(queries.at(-1)?.sql, 'ROLLBACK');
      assert.equal(queries.some(query => query.sql === 'COMMIT'), false);
    });
  }
}

test('missing articles return 404 without modifying summaries', async () => {
  for (const operation of [() => PUT(request('PUT', { id: 1, views: 1 })), () => DELETE(new Request('http://localhost/api/articles?id=1'))]) {
    const { response, queries } = await capture(operation, { missing: true });
    assert.equal(response.status, 404);
    assert.equal(queries.some(query => /^(?:INSERT|UPDATE|DELETE) /.test(query.sql)), false);
  }
});

for (const id of ['1abc', '-1', '0', '1.5', '9007199254740992']) {
  test(`rejects an invalid article id before querying: ${id}`, async () => {
    const { response, queries } = await capture(() => DELETE(new Request(`http://localhost/api/articles?id=${id}`)));
    assert.equal(response.status, 400);
    assert.deepEqual(queries, []);
  });
}
