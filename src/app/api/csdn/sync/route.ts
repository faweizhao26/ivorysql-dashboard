import { NextResponse } from 'next/server';
import { persistSyncedArticles } from '@/lib/article-sync';
import { fetchSyncHtml } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';
import { runTrackedSync } from '@/lib/tracked-sync';
import { parseCSDNArticles } from '@/lib/content-html';

const PLATFORM = 'csdn';

export async function scrapeCSDN(username: string = 'IvorySQL'): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = `https://blog.csdn.net/${username}`;

  console.log(`Starting CSDN sync for user: ${username}`);

  try {
    const html = await fetchSyncHtml(baseUrl);
    const articles = parseCSDNArticles(html);

    console.log(`Found ${articles.length} articles`);

    return await persistSyncedArticles(PLATFORM, articles);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('CSDN sync error:', message);
    return { success: false, error: message };
  }
}

export async function POST(request?: Request) {
  try {
    const tracked = await runTrackedSync({
      platform: PLATFORM,
      trigger: request?.method === 'GET' ? 'vercel_cron' : 'manual',
    }, async () => {
      const result = await scrapeCSDN();
      if (!result.success) throw new Error(result.error || 'CSDN sync failed');
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
