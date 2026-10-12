import { NextResponse } from 'next/server';
import { refreshKnownArticleMetrics } from '@/lib/article-sync';
import { parseSegmentFaultArticle } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';
import { runTrackedSync } from '@/lib/tracked-sync';

export async function syncSegmentFault(): Promise<{
  success: boolean;
  articles?: number;
  failed?: number;
  error?: string;
}> {
  try {
    return await refreshKnownArticleMetrics('sf', parseSegmentFaultArticle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('SegmentFault sync error:', message);
    return { success: false, error: message };
  }
}

export async function POST(request?: Request) {
  try {
    const tracked = await runTrackedSync({
      platform: 'sf',
      trigger: request?.method === 'GET' ? 'vercel_cron' : 'manual',
    }, async () => {
      const result = await syncSegmentFault();
      if (!result.success) throw new Error(result.error || 'SegmentFault sync failed');
      const count = result.articles || 0;
      return { value: result, recordsSeen: count + (result.failed || 0), recordsWritten: count };
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
