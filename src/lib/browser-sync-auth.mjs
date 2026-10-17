import { timingSafeEqual } from 'node:crypto';

const PREFIX = 'browser-sync-v1';
const MAX_AGE_SECONDS = 15 * 60;
const encoder = new TextEncoder();

async function signingKey(password) {
  return crypto.subtle.importKey(
    'raw', encoder.encode(`${password}:browser-sync`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

export async function createBrowserSyncToken(adminPassword) {
  if (!adminPassword) throw new Error('自动同步未配置 ADMIN_PASSWORD 或 CRON_SECRET');
  const now = Math.floor(Date.now() / 1000);
  const payload = `${PREFIX}.${now}.${now + MAX_AGE_SECONDS}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(adminPassword), encoder.encode(payload));
  return `${payload}.${Buffer.from(signature).toString('base64url')}`;
}

export async function isMachineSyncAuthorized(authorization, adminPassword, cronSecret) {
  if (!authorization?.startsWith('Bearer ')) return false;
  const token = authorization.slice(7);
  if (cronSecret) {
    const actual = Buffer.from(token);
    const expected = Buffer.from(cronSecret);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  if (!adminPassword) return false;
  const [prefix, issued, expires, signature, extra] = token.split('.');
  if (prefix !== PREFIX || extra !== undefined || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  if (!/^(0|[1-9]\d*)$/.test(issued) || !/^(0|[1-9]\d*)$/.test(expires)) return false;
  const start = Number(issued);
  const end = Number(expires);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start > now + 30 || end <= now || end <= start || end - start > MAX_AGE_SECONDS) return false;
  return crypto.subtle.verify('HMAC', await signingKey(adminPassword), Buffer.from(signature, 'base64url'), encoder.encode(`${prefix}.${issued}.${expires}`));
}
