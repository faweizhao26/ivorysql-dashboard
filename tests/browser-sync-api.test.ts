import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { createHmac } from 'node:crypto';
import * as route from '../src/app/api/browser-content/sync/route';

const originalEnv = { ...process.env };
test.before(() => { process.env.ADMIN_PASSWORD = 'machine-test'; });
test.after(() => { process.env = originalEnv; });

function request(method: string, body?: unknown, query = '') {
  const now = Math.floor(Date.now() / 1000);
  const payload = `browser-sync-v1.${now}.${now + 900}`;
  const signature = createHmac('sha256', 'machine-test:browser-sync').update(payload).digest('base64url');
  return new Request(`https://dashboard.test/api/browser-content/sync${query}`, {
    method,
    headers: { authorization: `Bearer ${payload}.${signature}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('preflight and historical dates work with machine auth, without a login cookie', async (t) => {
  assert.equal(typeof route.GET, 'function');
  const response = await route.GET(request('GET'));
  assert.deepEqual(await response.json(), { success: true, version: 1 });
  const calls: unknown[][] = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async (...args: unknown[]) => {
    calls.push(args);
    return { rows: [{ article_url: 'https://example.test/a', date: '2026-01-01', article_title: 'private title' }] };
  });
  const dates = await route.GET(request('GET', undefined, '?platform=toutiao'));
  assert.equal(dates.status, 200);
  assert.deepEqual(await dates.json(), { success: true, dates: [['https://example.test/a', '2026-01-01']] });
  assert.ok(calls.length > 0);
  const invalid = await route.GET(request('GET', undefined, '?platform=wechat'));
  assert.equal(invalid.status, 400);
});

test('collector failures are recorded separately without updating articles', async (t) => {
  const calls: { sql: string; values: unknown[] }[] = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values: unknown[]) => {
    calls.push({ sql, values });
    return { rows: /INSERT INTO sync_runs/.test(sql) ? [{ id: 7 }] : [] };
  });
  const response = await route.POST(request('POST', { platform: 'zhihu', status: 'failed', error: '知乎登录失效' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, runId: 7 });
  assert.ok(calls.some(call => /INSERT INTO sync_runs/.test(call.sql) && call.values[0] === 'zhihu'));
  assert.ok(calls.some(call => /UPDATE sync_runs/.test(call.sql) && call.values[0] === 'failed' && call.values[3] === '知乎登录失效'));
  assert.equal(calls.some(call => /(?:INSERT|UPDATE).*article/i.test(call.sql)), false);
});
