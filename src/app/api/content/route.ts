import { NextResponse } from 'next/server';
import { getArticlePlatformSummaries } from '@/lib/db';
import { parseArticleDateRange } from '@/lib/article-query';
import { CONTENT_PLATFORMS } from '@/lib/content-overview';

export async function GET(request: Request) {
  try {
    const range = parseArticleDateRange(new URL(request.url).searchParams);
    const summaries = await getArticlePlatformSummaries(range);
    const byPlatform = new Map(summaries.map(row => [row.platform, row]));
    const platforms = CONTENT_PLATFORMS.map(({ key }) => byPlatform.get(key) ?? {
      platform: key, article_count: 0, total_views: 0, data_date: null, updated_at: null,
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
