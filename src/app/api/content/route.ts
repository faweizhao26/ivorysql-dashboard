import { NextResponse } from 'next/server';
import { getArticleStatsByDateRange, getLatestArticleStats, getAllArticlePlatforms } from '@/lib/db';
import { createPlatformFreshness } from '@/lib/data-slices';
import { getDataRangeParams } from '@/lib/date-query';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate, isSingleDay } = getDataRangeParams(
      searchParams,
      new Date().toISOString().split('T')[0],
    );
    const platform = searchParams.get('platform');

    if (platform) {
      const data = await getArticleStatsByDateRange(startDate, endDate, platform);
      const latest = await getLatestArticleStats(endDate);
      return NextResponse.json({
        platform,
        data,
        freshness: createPlatformFreshness(
          [platform],
          isSingleDay ? startDate : undefined,
          isSingleDay ? data : data.slice(-1),
          latest.filter(row => row.platform === platform),
        ),
      });
    }

    const platforms = await getAllArticlePlatforms();
    if (platforms.length === 0) {
      return NextResponse.json({ platforms: [], articles: [] });
    }

    const [allData, latest] = await Promise.all([
      Promise.all(
      platforms.map(async (p) => {
        const data = await getArticleStatsByDateRange(startDate, endDate, p);
        return { platform: p, data };
      })),
      getLatestArticleStats(endDate),
    ]);

    // Fill in latest data for platforms with no data in range
    const articles = await Promise.all(
      allData.map(async ({ platform: p, data }) => {
        if (data.length > 0) return data;
        return latest.filter(row => row.platform === p).slice(-1);
      })
    );

    const flattened = articles.flat();
    const exactRows = isSingleDay ? allData.flatMap(item => item.data) : flattened;

    return NextResponse.json({
      platforms,
      articles: flattened,
      freshness: createPlatformFreshness(
        platforms,
        isSingleDay ? startDate : undefined,
        exactRows,
        latest,
      ),
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching content data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
