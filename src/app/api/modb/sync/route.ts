import { NextResponse } from 'next/server';
import { scrapeModb } from '@/lib/modb-sync';

const MODB_USER_ID = process.env.MODB_USER_ID || '471017';

export async function POST() {
  try {
    const result = await scrapeModb(MODB_USER_ID);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('modb sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync modb data' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    platform: 'modb',
    userId: MODB_USER_ID,
    configured: true
  });
}