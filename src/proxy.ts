import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAccessTokenSecret, readAccessToken } from '@/lib/auth';

const STATIC_PATTERN = /\.(js|css|png|ico|svg|woff2?|map|json|txt)$/;

function isCronRequest(request: NextRequest, pathname: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  if (!/^\/api\/(github|itpub|csdn|cnblogs|juejin|modb)\/sync/.test(pathname)) return false;
  if (request.method !== 'GET') return false;

  const authHeader = request.headers.get('authorization');
  const secretHeader = request.headers.get('x-cron-secret');
  return authHeader === `Bearer ${cronSecret}` || secretHeader === cronSecret;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || STATIC_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (isCronRequest(request, pathname)) {
    return NextResponse.next();
  }

  const accessPassword = process.env.ACCESS_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!accessPassword || !adminPassword) {
    console.error('WARNING: ACCESS_PASSWORD or ADMIN_PASSWORD not set. Auth enabled but unavailable.');
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Server auth not configured' }, { status: 503 });
    }
    return NextResponse.redirect(new URL('/auth?error=server_not_configured', request.url));
  }

  const accessCookie = request.cookies.get('access_level');
  const accessLevel = await readAccessToken(
    accessCookie?.value,
    getAccessTokenSecret(accessPassword, adminPassword)
  );

  if (accessLevel === 'admin') {
    return NextResponse.next();
  }

  if (accessLevel === 'viewer') {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/auth?error=admin_required', request.url));
    }
    if (/^\/api\/(articles|events|manual|reminders)/.test(pathname) && request.method !== 'GET') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }
    if (/^\/api\/(github|itpub|csdn|cnblogs|juejin|modb)\/sync/.test(pathname)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }
    return NextResponse.next();
  }

  const loginUrl = new URL('/auth', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
