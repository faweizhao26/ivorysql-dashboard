import { NextResponse } from 'next/server';
import { scrapeITPub } from '@/lib/itpub-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';

const ITPUB_USER_ID = process.env.ITPUB_USER_ID || '70043484';

export async function POST() {
  const result = await scrapeITPub(ITPUB_USER_ID);
  return NextResponse.json(result, { status: getSyncHttpStatus(result) });
}

export async function GET() {
  return POST();
}
