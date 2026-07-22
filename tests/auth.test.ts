import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccessToken, readAccessToken } from '../src/lib/auth';

test('rejects unsigned access-level cookie values', async () => {
  const token = await readAccessToken('admin', 'secret');

  assert.equal(token, null);
});

test('accepts signed access tokens created with the same secret', async () => {
  const value = await createAccessToken('viewer', 'secret');
  const token = await readAccessToken(value, 'secret');

  assert.equal(token, 'viewer');
});

test('rejects signed access tokens created with a different secret', async () => {
  const value = await createAccessToken('admin', 'secret');
  const token = await readAccessToken(value, 'other-secret');

  assert.equal(token, null);
});
