import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_MAX_AGE_SECONDS, createAccessToken, getAccessTokenSecret, resolvePasswordAccess } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const accessPassword = process.env.ACCESS_PASSWORD;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!accessPassword || !adminPassword) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const viewerPassword = process.env.VIEWER_PASSWORD;
    const secret = getAccessTokenSecret(accessPassword, adminPassword, viewerPassword);
    const level = resolvePasswordAccess(password, { accessPassword, adminPassword, viewerPassword });
    if (level) {
      const cookieStore = await cookies();
      cookieStore.set('access_level', await createAccessToken(level, secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS
      });
      return NextResponse.json({ level, message: 'Access granted' });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
