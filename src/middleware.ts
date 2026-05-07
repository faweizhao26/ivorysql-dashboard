import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const STATIC_PATTERN = /\.(js|css|png|ico|svg|woff2?|map|json|txt)$/;

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || STATIC_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const accessPassword = process.env.ACCESS_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!accessPassword || !adminPassword) {
    console.error('WARNING: ACCESS_PASSWORD or ADMIN_PASSWORD not set. Auth disabled.');
    return NextResponse.next();
  }

  const accessCookie = request.cookies.get('access_level');

  if (accessCookie && accessCookie.value === 'admin') {
    return NextResponse.next();
  }

  if (accessCookie && accessCookie.value === 'viewer') {
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