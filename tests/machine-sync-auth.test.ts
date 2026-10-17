import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserSyncToken, isMachineSyncAuthorized } from '../src/lib/browser-sync-auth.mjs';
import { readAccessToken } from '../src/lib/auth';

test('machine tokens are scoped, short-lived, signed and invalidated by password rotation', async (t) => {
  let now = 1_700_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const token = await createBrowserSyncToken('test-only');
  assert.equal(await isMachineSyncAuthorized(`Bearer ${token}`, 'test-only', undefined), true);
  assert.equal(await readAccessToken(token, 'test-only'), null);
  assert.equal(await isMachineSyncAuthorized(`Bearer ${token}`, 'changed', undefined), false);
  assert.equal(await isMachineSyncAuthorized(`Bearer ${token}.extra`, 'test-only', undefined), false);
  assert.equal(await isMachineSyncAuthorized(`Bearer ${token.slice(0, -2)}AA`, 'test-only', undefined), false);
  now += 15 * 60 * 1000;
  assert.equal(await isMachineSyncAuthorized(`Bearer ${token}`, 'test-only', undefined), false);
});
