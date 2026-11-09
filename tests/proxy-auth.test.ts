import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import { createAccessToken, getAccessTokenSecret } from '../src/lib/auth';

const originalEnv = { ...process.env };
test.before(() => {
  process.env.ACCESS_PASSWORD = 'viewer-test';
  process.env.ADMIN_PASSWORD = 'admin-test';
  process.env.VIEWER_PASSWORD = 'full-viewer-test';
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

async function session(level: 'admin' | 'viewer' | 'evangelist') {
  const token = await createAccessToken(level, getAccessTokenSecret('viewer-test', 'admin-test', 'full-viewer-test'));
  return { cookie: `access_level=${token}` };
}

test('evangelist password sessions can only read the evangelist page and its exact API', async () => {
  const headers = await session('evangelist');
  for (const path of ['/evangelist', '/api/evangelist', '/api/evangelist?participant_id=1']) {
    const response = await proxy(new NextRequest(`https://dashboard.test${path}`, { headers }));
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
  }
  for (const path of ['/', '/github', '/social', '/content', '/downloads', '/events', '/admin', '/evangelist/other']) {
    const response = await proxy(new NextRequest(`https://dashboard.test${path}`, { headers }));
    assert.equal(new URL(response.headers.get('location')!).pathname, '/evangelist', path);
  }
  for (const path of ['/api/dashboard', '/api/content', '/api/articles', '/api/reminders', '/api/sync-status', '/api/evangelist/other', '/api/dashboard.json', '/api/github/sync']) {
    const response = await proxy(new NextRequest(`https://dashboard.test${path}`, { headers }));
    assert.equal(response.status, 403, path);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await proxy(new NextRequest('https://dashboard.test/api/evangelist', { headers, method }));
    assert.equal(response.status, 403, method);
  }
});

test('full-site viewer sessions retain all read access but no administration or writes', async () => {
  const headers = await session('viewer');
  for (const path of ['/', '/github', '/content', '/events', '/evangelist', '/api/dashboard', '/api/content', '/api/evangelist']) {
    const response = await proxy(new NextRequest(`https://dashboard.test${path}`, { headers }));
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
  }
  for (const path of ['/api/evangelist', '/api/articles', '/api/events', '/api/manual', '/api/reminders']) {
    const response = await proxy(new NextRequest(`https://dashboard.test${path}`, { headers, method: 'POST' }));
    assert.equal(response.status, 401, path);
  }
  const admin = await proxy(new NextRequest('https://dashboard.test/admin', { headers }));
  assert.equal(new URL(admin.headers.get('location')!).pathname, '/auth');
  const writable = await proxy(new NextRequest('https://dashboard.test/api/evangelist', { headers: await session('admin'), method: 'POST' }));
  assert.equal(writable.headers.get('x-middleware-next'), '1');
});
