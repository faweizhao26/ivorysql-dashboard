import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAccessToken, getAccessTokenSecret } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const accessPassword = process.env.ACCESS_PASSWORD;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!accessPassword || !adminPassword) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const secret = getAccessTokenSecret(accessPassword, adminPassword);

    if (password === adminPassword) {
      const cookieStore = await cookies();
      cookieStore.set('access_level', await createAccessToken('admin', secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
      return NextResponse.json({ level: 'admin', message: 'Admin access granted' });
    }

    if (password === accessPassword) {
      const cookieStore = await cookies();
      cookieStore.set('access_level', await createAccessToken('viewer', secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
      return NextResponse.json({ level: 'viewer', message: 'Access granted' });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
