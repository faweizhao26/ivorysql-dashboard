import { NextResponse } from 'next/server';
import { persistSyncedArticles } from '@/lib/article-sync';
import { ARTICLE_SYNC_LIMIT, fetchSyncHtml } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';
import { runTrackedSync } from '@/lib/tracked-sync';

const PLATFORM = 'cnblogs';

function extractArticles(html: string) {
  const articles: { title: string; link: string; views: number; date: string }[] = [];

  const dayBlocks = html.match(/<div class="day"[^>]*>[\s\S]*?(?=<div class="day"|$)/g);
  if (!dayBlocks) return articles;

  for (const block of dayBlocks) {
    const dayDateMatch = block.match(/<a[^>]*>(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const dayDate = dayDateMatch
      ? `${dayDateMatch[1]}-${dayDateMatch[2].padStart(2, '0')}-${dayDateMatch[3].padStart(2, '0')}`
      : '';

    const postMatches = block.matchAll(/<a class="postTitle2[^"]*" href="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>/g);

    for (const postMatch of postMatches) {
      const link = postMatch[1];
      const title = postMatch[2].trim();
      const postIndex = postMatch.index;

      const postDescSection = block.substring(postIndex);
      const postedMatch = postDescSection.match(/posted\s*@\s*(\d{4}-\d{2}-\d{2})/);
      const date = postedMatch ? postedMatch[1] : dayDate;

      const viewMatch = postDescSection.match(/class="post-view-count"[^>]*>\s*阅读\((\d+)\)/);
      const views = viewMatch ? parseInt(viewMatch[1]) : 0;

      if (title && link) {
        articles.push({ title, link, views, date });
      }
    }
  }

  return articles;
}

export async function scrapeCnblogs(username: string = 'ivorysql'): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = 'https://www.cnblogs.com/' + username;

  console.log('Starting cnblogs sync for user: ' + username);

  try {
    const allArticles: { title: string; link: string; views: number; date: string }[] = [];

    for (let page = 1; page <= 5; page++) {
      const url = page === 1 ? baseUrl : baseUrl + '?page=' + page;
      const html = await fetchSyncHtml(url);
      const articles = extractArticles(html);

      if (articles.length === 0) break;
      allArticles.push(...articles);
      if (allArticles.length >= ARTICLE_SYNC_LIMIT) break;
      await new Promise(r => setTimeout(r, 500));
    }

    return await persistSyncedArticles(PLATFORM, allArticles.map(article => ({
      title: article.title,
      url: article.link,
      date: article.date || new Date().toISOString().split('T')[0],
      views: article.views,
    })));
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
