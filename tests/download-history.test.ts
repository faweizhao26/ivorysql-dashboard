import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { GET } from '../src/app/api/downloads/history/route';

test('history reads only dated download counters, without initialization or upstream requests', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T16:01:00Z') });
  const connect = t.mock.method(Pool.prototype, 'connect', () => assert.fail('unexpected schema initialization'));
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected upstream request'));
  const rows = [
    { date: '2026-11-23', github_total: 0, docker_total: 12 },
    { date: '2026-11-25', github_total: 4, docker_total: 29 },
  ];
  const query = t.mock.method(Pool.prototype, 'query', async () => ({ rows }));

  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { downloads: rows });
  assert.equal(query.mock.callCount(), 1);
  const [sql, values] = query.mock.calls[0].arguments;
  assert.match(String(sql), /^\s*SELECT\s+date,\s*github_total,\s*docker_total\s+FROM download_stats\s+WHERE date BETWEEN \$1 AND \$2\s+ORDER BY date ASC\s*$/i);
  assert.deepEqual(values, ['2025-11-26', '2026-11-25']);
  assert.equal(connect.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test('an empty history is successful; a failed read is not an empty history', async (t) => {
  const query = t.mock.method(Pool.prototype, 'query', async () => ({ rows: [] }));
  const empty = await GET();
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { downloads: [] });

  t.mock.method(console, 'error', () => {});
  query.mock.mockImplementation(() => { throw new Error('internal database detail'); });
  const failure = await GET();
  assert.equal(failure.status, 500);
  const body = await failure.json();
  assert.ok(body.error);
  assert.ok(!('downloads' in body));
  assert.doesNotMatch(body.error, /internal database detail/);
});
