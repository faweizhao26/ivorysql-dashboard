import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { GET } from '../src/app/api/downloads/route';
import { collectGitHubDownloads, collectDockerDownloads, recordDownloadSnapshot } from '../src/lib/download-stats';

const originalEnv = { ...process.env };
test.before(() => { process.env.GITHUB_TOKEN = 'test-only'; });
test.after(() => { process.env = originalEnv; });

test('upstream HTTP failures are unknown, not successful zero totals', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async () => ({ rows: [] }));
  const response = await GET();
  const data = await response.json();
  assert.equal(response.status, 502);
  assert.equal(data.partial, true);
  assert.equal(data.github.total, null);
  assert.equal(data.docker.total, null);
  assert.equal(data.github.status, 'unavailable');
});

test('failed sources retain historical totals and are marked stale', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).includes('api.github.com')
    ? new Response('unauthorized', { status: 401 })
    : Response.json({ count: 1, results: [{ name: 'ivorysql', pull_count: 42 }], next: null }));
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async () => ({ rows: [{ date: '2026-10-16', github_total: 500, docker_total: 1000 }] }));
  const response = await GET();
  const data = await response.json();
  assert.equal(response.status, 502);
  assert.equal(data.github.total, 500);
  assert.equal(data.github.status, 'stale');
  assert.equal(data.github.data_date, '2026-10-16');
  assert.equal(data.docker.total, 42);
  assert.equal(data.docker.status, 'live');
});

test('successful empty source collections are real zero totals', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).includes('api.github.com')
    ? Response.json([]) : Response.json({ count: 0, results: [], next: null }));
  const response = await GET();
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.github.total, 0);
  assert.equal(data.docker.total, 0);
  assert.equal(data.github.status, 'live');
});

test('an upstream failure never overwrites a stored snapshot', async () => {
  const writes: unknown[] = [];
  await assert.rejects(recordDownloadSnapshot('2026-10-17', {
    fetcher: async (input) => String(input).includes('api.github.com') ? Response.json([]) : new Response('', { status: 503 }),
    save: async (...values) => { writes.push(values); },
  }), /503/);
  assert.deepEqual(writes, []);
});

test('only complete and valid counters are saved, including measured zeros', async () => {
  const writes: unknown[] = [];
  await recordDownloadSnapshot('2026-10-17', {
    fetcher: async input => String(input).includes('api.github.com')
      ? Response.json([{ tag_name: 'v1', assets: [{ name: 'source', download_count: 0 }] }])
      : Response.json({ count: 1, results: [{ name: 'ivorysql', pull_count: 10 }], next: null }),
    save: async (...values) => { writes.push(values); },
  });
  assert.deepEqual(writes, [['2026-10-17', 0, 10]]);
  for (const downloadCount of [undefined, null, -1, '10']) {
    await assert.rejects(collectGitHubDownloads({ fetcher: async () => Response.json([{ tag_name: 'v1', assets: [{ name: 'source', download_count: downloadCount }] }]) }), /计数/);
  }
});

test('later GitHub page errors cannot become partial totals', async () => {
  await assert.rejects(collectGitHubDownloads({ fetcher: async input => {
    const page = new URL(String(input)).searchParams.get('page');
    return page === '1'
      ? Response.json(Array.from({ length: 100 }, (_, index) => ({ tag_name: `v${index}`, assets: [{ name: 'source', download_count: 10 }] })))
      : new Response('', { status: 503 });
  } }), /503/);
});

test('Docker pages are followed but external, cyclic and incomplete pages are rejected', async () => {
  const result = await collectDockerDownloads({ fetcher: async input => new URL(String(input)).searchParams.get('page') === '2'
    ? Response.json({ count: 2, results: [{ name: 'second', pull_count: 20 }], next: null })
    : Response.json({ count: 2, results: [{ name: 'first', pull_count: 10 }], next: '?page=2' }) });
  assert.equal(result.total, 30);
  for (const next of ['https://other.test/', '?page_size=100', null]) {
    await assert.rejects(collectDockerDownloads({ fetcher: async () => Response.json({ count: 2, results: [{ name: 'first', pull_count: 10 }], next }) }), /分页|不完整/);
  }
});
