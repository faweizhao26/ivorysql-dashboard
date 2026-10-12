import { NextResponse } from 'next/server';
import { scrapeModb } from '@/lib/modb-sync';
import { refreshKnownArticleMetrics } from '@/lib/article-sync';
import { parseModbArticle } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';
import { runTrackedSync } from '@/lib/tracked-sync';

const MODB_USER_ID = process.env.MODB_USER_ID || '471017';

export async function syncModb() {
  try {
    const social = await scrapeModb(MODB_USER_ID);
    if (!social.success) return social;
    const articles = await refreshKnownArticleMetrics('modb', parseModbArticle);
    return {
      success: true,
      stats: social.stats,
      articles: articles.articles,
      failed: articles.failed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('modb sync error:', message);
    return { success: false, error: message || 'Failed to sync modb data' };
  }
}

export async function POST(request?: Request) {
  try {
    const tracked = await runTrackedSync({
      platform: 'modb',
      trigger: request?.method === 'GET' ? 'vercel_cron' : 'manual',
    }, async () => {
      const result = await syncModb();
      if (!result.success) {
        throw new Error(('error' in result && result.error) || 'modb sync failed');
      }
      const written = 'articles' in result ? result.articles : 0;
      const failed = 'failed' in result ? result.failed : 0;
      return {
        value: result,
        recordsSeen: written + failed + 1,
        recordsWritten: written + 1,
      };
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
