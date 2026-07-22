import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAccessTokenSecret, readAccessToken } from '@/lib/auth';

export async function GET() {
  const accessPassword = process.env.ACCESS_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!accessPassword || !adminPassword) {
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }

  const cookieStore = await cookies();
  const accessLevel = cookieStore.get('access_level');
  const level = await readAccessToken(accessLevel?.value, getAccessTokenSecret(accessPassword, adminPassword));

  if (!level) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    level
  });
}
