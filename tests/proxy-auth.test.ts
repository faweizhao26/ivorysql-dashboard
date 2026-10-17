import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

const originalEnv = { ...process.env };
test.before(() => {
  process.env.ACCESS_PASSWORD = 'viewer-test';
  process.env.ADMIN_PASSWORD = 'admin-test';
});
test.after(() => { process.env = originalEnv; });

test('expired API sessions return JSON 401 rather than a login redirect', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await proxy(new NextRequest('https://dashboard.test/api/articles', { method }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('location'), null);
    assert.deepEqual(await response.json(), { error: '登录已失效，请重新登录', code: 'AUTH_REQUIRED' });
  }
});

test('page navigation still redirects to login with the original path and query', async () => {
  const response = await proxy(new NextRequest('https://dashboard.test/content?platform=zhihu'));
  const location = new URL(response.headers.get('location')!);
  assert.equal(response.status, 307);
  assert.equal(location.pathname, '/auth');
  assert.equal(location.searchParams.get('redirect'), '/content?platform=zhihu');
});

test('a scoped machine token bypasses cookies only on browser sync GET and POST', async () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = `browser-sync-v1.${now}.${now + 900}`;
  const signature = createHmac('sha256', 'admin-test:browser-sync').update(payload).digest('base64url');
  const headers = { authorization: `Bearer ${payload}.${signature}` };
  for (const method of ['GET', 'POST']) {
    const response = await proxy(new NextRequest('https://dashboard.test/api/browser-content/sync', { method, headers }));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
  for (const path of ['/api/articles', '/api/evangelist', '/api/github/sync']) {
    const response = await proxy(new NextRequest(`https://dashboard.test${path}`, { headers }));
    assert.equal(response.status, 401);
  }
});
