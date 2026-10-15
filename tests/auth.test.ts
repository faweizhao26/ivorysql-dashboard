import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createAccessToken, getAccessTokenSecret, readAccessToken } from '../src/lib/auth';

const issuedAt = 1_700_000_000;
const expiresAt = 1_700_604_800;
const secret = 'test-only-secret';

function signedToken(payload: string, key = secret): string {
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

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

test('signs the role, issuance time and seven-day expiry together', async (t) => {
  t.mock.method(Date, 'now', () => issuedAt * 1000 + 999);

  const value = await createAccessToken('viewer', secret);

  assert.equal(value, signedToken(`viewer.${issuedAt}.${expiresAt}`));
});

for (const level of ['admin', 'viewer'] as const) {
  test(`${level} tokens expire at the server boundary even when replayed`, async (t) => {
    let now = issuedAt * 1000;
    t.mock.method(Date, 'now', () => now);
    const value = await createAccessToken(level, secret);

    assert.equal(await readAccessToken(value, secret), level);
    now = expiresAt * 1000 - 1;
    assert.equal(await readAccessToken(value, secret), level);
    now = expiresAt * 1000;
    assert.equal(await readAccessToken(value, secret), null);
    now += 1000;
    assert.equal(await readAccessToken(value, secret), null);
  });

  test(`rejects future-issued ${level} tokens`, async (t) => {
    let now = issuedAt * 1000;
    t.mock.method(Date, 'now', () => now);
    const value = await createAccessToken(level, secret);

    now -= 1000;
    assert.equal(await readAccessToken(value, secret), null);
  });

  test(`rejects legacy non-expiring ${level} tokens even with a valid signature`, async () => {
    assert.equal(await readAccessToken(signedToken(level), secret), null);
  });
}

test('rejects changes to every signed field and to the signature', async (t) => {
  let now = issuedAt * 1000;
  t.mock.method(Date, 'now', () => now);
  const value = await createAccessToken('viewer', secret);
  const [level, start, end, signature] = value.split('.');
  now += 10_000;

  for (const tampered of [
    `admin.${start}.${end}.${signature}`,
    `${level}.${issuedAt + 1}.${end}.${signature}`,
    `${level}.${start}.${expiresAt - 1}.${signature}`,
    `${level}.${start}.${end}.${signature?.startsWith('A') ? 'B' : 'A'}${signature?.slice(1)}`,
  ]) {
    assert.equal(await readAccessToken(tampered, secret), null);
  }
});

test('rejects malformed, unsigned and unknown-role tokens', async (t) => {
  t.mock.method(Date, 'now', () => issuedAt * 1000);
  const value = await createAccessToken('admin', secret);

  for (const malformed of [
    undefined, '', 'admin', 'viewer', 'admin.',
    `admin.${issuedAt}.${expiresAt}`,
    `${value}.extra`, `${value}.`, `.${value}`,
    signedToken(`owner.${issuedAt}.${expiresAt}`),
    signedToken(`.${issuedAt}.${expiresAt}`),
  ]) {
    assert.equal(await readAccessToken(malformed, secret), null, String(malformed));
  }
});

test('rejects invalid signed timestamps and lifetimes', async (t) => {
  t.mock.method(Date, 'now', () => issuedAt * 1000);

  for (const [start, end] of [
    ['', expiresAt], [issuedAt, ''],
    ['NaN', expiresAt], [issuedAt, 'Infinity'],
    ['-1', expiresAt], [issuedAt, '-1'],
    ['1699999999.5', expiresAt], [issuedAt, '1700604800.5'],
    ['1e9', expiresAt], [issuedAt, '1.7006048e9'],
    [` ${issuedAt}`, expiresAt], [issuedAt, `${expiresAt} `],
    [`0${issuedAt}`, expiresAt], [issuedAt, `0${expiresAt}`],
    ['9007199254740992', expiresAt], [issuedAt, '9007199254740992'],
    [issuedAt + 1, expiresAt],
    [issuedAt, issuedAt], [issuedAt, issuedAt - 1],
    [issuedAt - 1, expiresAt], [issuedAt, expiresAt + 1],
  ]) {
    const value = signedToken(`admin.${start}.${end}`);
    assert.equal(await readAccessToken(value, secret), null, `${start}.${end}`);
  }
});

test('rejects signed timestamps with trailing line breaks', async (t) => {
  t.mock.method(Date, 'now', () => issuedAt * 1000);

  for (const suffix of ['\n', '\r', '\r\n']) {
    for (const payload of [
      `admin.${issuedAt}${suffix}.${expiresAt}`,
      `admin.${issuedAt}.${expiresAt}${suffix}`,
    ]) {
      assert.equal(await readAccessToken(signedToken(payload), secret), null);
    }
  }
});

test('rotating either password invalidates existing tokens', async (t) => {
  t.mock.method(Date, 'now', () => issuedAt * 1000);
  const key = getAccessTokenSecret('test-viewer-password', 'test-admin-password');
  const value = await createAccessToken('admin', key);

  assert.equal(await readAccessToken(value, key), 'admin');
  assert.equal(await readAccessToken(value, getAccessTokenSecret('changed', 'test-admin-password')), null);
  assert.equal(await readAccessToken(value, getAccessTokenSecret('test-viewer-password', 'changed')), null);
});
