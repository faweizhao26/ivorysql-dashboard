export type AccessLevel = 'admin' | 'viewer';

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function base64Url(bytes: ArrayBuffer): string {
  const byteArray = new Uint8Array(bytes);
  let binary = '';
  for (const byte of byteArray) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64Url(signature);
}

function isAccessLevel(value: string): value is AccessLevel {
  return value === 'admin' || value === 'viewer';
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function getAccessTokenSecret(accessPassword: string, adminPassword: string): string {
  return `${accessPassword}:${adminPassword}`;
}

export async function createAccessToken(level: AccessLevel, secret: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_MAX_AGE_SECONDS;
  const payload = `${level}.${issuedAt}.${expiresAt}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function readAccessToken(value: string | undefined, secret: string): Promise<AccessLevel | null> {
  if (!value) return null;
  const [level, issuedAtValue, expiresAtValue, signature, extra] = value.split('.');
  if (extra !== undefined || !level || !signature || !isAccessLevel(level)) return null;
  if (!/^(0|[1-9]\d*)$/.test(issuedAtValue) || !/^(0|[1-9]\d*)$/.test(expiresAtValue)) return null;

  const issuedAt = Number(issuedAtValue);
  const expiresAt = Number(expiresAtValue);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
    issuedAt > now || expiresAt <= now || expiresAt <= issuedAt ||
    expiresAt - issuedAt > ACCESS_TOKEN_MAX_AGE_SECONDS
  ) return null;

  const expected = await sign(`${level}.${issuedAtValue}.${expiresAtValue}`, secret);
  return timingSafeEqual(signature, expected) ? level : null;
}
