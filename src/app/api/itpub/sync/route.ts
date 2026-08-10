import { NextResponse } from 'next/server';
import { scrapeITPub } from '@/lib/itpub-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';

const ITPUB_USER_ID = process.env.ITPUB_USER_ID || '70043484';

export async function POST() {
  try {
    const result = await scrapeITPub(ITPUB_USER_ID);
    return NextResponse.json(result, { status: getSyncHttpStatus(result) });
  } catch (error: any) {
    console.error('ITPub sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync ITPub data' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await scrapeITPub(ITPUB_USER_ID);
    return NextResponse.json(result, { status: getSyncHttpStatus(result) });
  } catch (error: any) {
    console.error('ITPub sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync ITPub data' }, { status: 500 });
  }
}
