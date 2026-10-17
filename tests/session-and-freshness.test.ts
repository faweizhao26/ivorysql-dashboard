import assert from 'node:assert/strict';
import test from 'node:test';
import { withSessionNotice, safeReturnPath } from '../src/lib/session-response';
import { syncFreshness } from '../src/lib/sync-freshness';

test('expired API session is reported without redirecting or consuming the response', async () => {
  let notices = 0;
  const original = Response.json({ code: 'AUTH_REQUIRED', error: 'expired' }, { status: 401 });
  const fetcher = withSessionNotice(async () => original, () => { notices += 1; }, 'https://dashboard.test');
  const response = await fetcher('/api/articles');
  assert.equal(response, original);
  assert.equal(notices, 1);
  assert.equal((await response.json()).code, 'AUTH_REQUIRED');
});

test('auth requests, permission errors and third-party requests do not show an expiry notice', async () => {
  for (const url of ['/api/auth/login', 'https://external.test/api/data']) {
    let notices = 0;
    await withSessionNotice(async () => Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 }), () => { notices += 1; }, 'https://dashboard.test')(url);
    assert.equal(notices, 0);
  }
  let notices = 0;
  await withSessionNotice(async () => Response.json({ error: 'admin required' }, { status: 401 }), () => { notices += 1; }, 'https://dashboard.test')('/api/articles');
  assert.equal(notices, 0);
});

test('login return paths cannot send users off-site', () => {
  assert.equal(safeReturnPath('/content?platform=zhihu'), '/content?platform=zhihu');
  for (const path of ['https://other.test', '//other.test', '/\\other.test', '/auth?redirect=/auth', null]) {
    assert.equal(safeReturnPath(path), '/');
  }
});

test('sync freshness follows daily and weekly schedules, not just the last run status', () => {
  const now = Date.parse('2026-10-16T08:00:00Z');
  assert.equal(syncFreshness('zhihu', null, now), 'never');
  assert.equal(syncFreshness('zhihu', '2026-10-15T08:00:00Z', now), 'fresh');
  assert.equal(syncFreshness('zhihu', '2026-10-13T08:00:00Z', now), 'stale');
  assert.equal(syncFreshness('itpub', '2026-10-09T08:00:00Z', now), 'fresh');
  assert.equal(syncFreshness('itpub', '2026-10-01T08:00:00Z', now), 'stale');
  assert.equal(syncFreshness('zhihu', 'invalid', now), 'never');
});
