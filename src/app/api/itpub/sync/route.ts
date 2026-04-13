import { NextResponse } from 'next/server';
import { scrapeITPub } from '@/lib/itpub-sync';

const ITPUB_USER_ID = process.env.ITPUB_USER_ID || '70043484';

export async function POST() {
  try {
    const result = await scrapeITPub(ITPUB_USER_ID);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('ITPub sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync ITPub data' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    platform: 'itpub',
    userId: ITPUB_USER_ID,
    configured: true
  });
}