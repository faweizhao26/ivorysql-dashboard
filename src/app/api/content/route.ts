import { NextResponse } from 'next/server';
import { getArticlePlatformSummaries } from '@/lib/db';
import { parseArticleDateRange } from '@/lib/article-query';
import { CONTENT_PLATFORMS } from '@/lib/content-overview';
import { getLatestSyncStatus } from '@/lib/sync-runs';

export async function GET(request: Request) {
  try {
    const range = parseArticleDateRange(new URL(request.url).searchParams);
    const summaries = await getArticlePlatformSummaries(range);
    let syncUnavailable = false;
    const runs = await getLatestSyncStatus().catch(error => {
      console.error('Error fetching content collection status:', error);
      syncUnavailable = true;
      return [];
    });
    const byRun = new Map(runs.map(run => [run.platform, run]));
    const byPlatform = new Map(summaries.map(row => [row.platform, row]));
    const platforms = CONTENT_PLATFORMS.map(({ key }) => {
      const run = byRun.get(key);
      return {
        ...(byPlatform.get(key) ?? { platform: key, article_count: 0, total_views: 0, measured_articles: 0, missing_views: 0, data_date: null, updated_at: null }),
        sync: run ? { status: run.status, last_success_at: run.last_success_at, last_attempt_at: run.finished_at || run.started_at } : null,
        sync_unavailable: syncUnavailable,
      };
    });
    const updatedAt = platforms.reduce<string | null>((latest, item) => {
      if (!item.updated_at) return latest;
      return !latest || item.updated_at > latest ? item.updated_at : latest;
    }, null);
    return NextResponse.json({ platforms, updated_at: updatedAt });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error fetching content summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
