export type AccessLevel = 'admin' | 'viewer';

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
  return `${level}.${await sign(level, secret)}`;
}

export async function readAccessToken(value: string | undefined, secret: string): Promise<AccessLevel | null> {
  if (!value) return null;
  const [level, signature, extra] = value.split('.');
  if (extra !== undefined || !level || !signature || !isAccessLevel(level)) return null;

  const expected = await sign(level, secret);
  return timingSafeEqual(signature, expected) ? level : null;
}
