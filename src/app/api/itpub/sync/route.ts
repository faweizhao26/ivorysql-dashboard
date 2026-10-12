import { NextResponse } from 'next/server';
import { scrapeITPub } from '@/lib/itpub-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';
import { runTrackedSync } from '@/lib/tracked-sync';

const ITPUB_USER_ID = process.env.ITPUB_USER_ID || '70043484';

export async function POST(request?: Request) {
  try {
    const tracked = await runTrackedSync({
      platform: 'itpub',
      trigger: request?.method === 'GET' ? 'vercel_cron' : 'manual',
    }, async () => {
      const result = await scrapeITPub(ITPUB_USER_ID);
      if (!result.success) throw new Error(result.error || 'ITPUB sync failed');
      const count = result.articles || 0;
      return { value: result, recordsSeen: count, recordsWritten: count };
    });
    return NextResponse.json({ ...tracked.value, runId: tracked.runId });
  } catch (error) {
    const result = { success: false, error: error instanceof Error ? error.message : String(error) };
    return NextResponse.json(result, { status: getSyncHttpStatus(result) });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
