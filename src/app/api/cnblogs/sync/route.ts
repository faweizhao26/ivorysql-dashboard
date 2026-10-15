import { NextResponse } from 'next/server';
import { persistSyncedArticles } from '@/lib/article-sync';
import { ARTICLE_SYNC_LIMIT, fetchSyncHtml } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';
import { runTrackedSync } from '@/lib/tracked-sync';
import { parseCnblogsArticles } from '@/lib/content-html';
import type { SyncedArticle } from '@/lib/content-sync';

const PLATFORM = 'cnblogs';

export async function scrapeCnblogs(username: string = 'ivorysql'): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = 'https://www.cnblogs.com/' + username;

  console.log('Starting cnblogs sync for user: ' + username);

  try {
    const allArticles: SyncedArticle[] = [];

    for (let page = 1; page <= 5; page++) {
      const url = page === 1 ? baseUrl : baseUrl + '?page=' + page;
      const html = await fetchSyncHtml(url);
      const articles = parseCnblogsArticles(html);

      if (articles.length === 0) break;
      allArticles.push(...articles);
      if (allArticles.length >= ARTICLE_SYNC_LIMIT) break;
      await new Promise(r => setTimeout(r, 500));
    }

    return await persistSyncedArticles(PLATFORM, allArticles);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('cnblogs sync error:', message);
    return { success: false, error: message };
  }
}

export async function POST(request?: Request) {
  try {
    const tracked = await runTrackedSync({
      platform: PLATFORM,
      trigger: request?.method === 'GET' ? 'vercel_cron' : 'manual',
    }, async () => {
      const result = await scrapeCnblogs();
      if (!result.success) throw new Error(result.error || 'cnblogs sync failed');
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
