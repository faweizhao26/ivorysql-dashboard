import { NextResponse } from 'next/server';
import { getSocialStatsByDateRange, getLatestSocialStats, getAllSocialPlatforms } from '@/lib/db';
import { createPlatformFreshness } from '@/lib/data-slices';
import { getDataRangeParams } from '@/lib/date-query';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate, isSingleDay } = getDataRangeParams(searchParams);
    const platform = searchParams.get('platform');

    if (platform) {
      const data = await getSocialStatsByDateRange(startDate, endDate, platform);
      const latest = await getLatestSocialStats(endDate);
      const freshness = createPlatformFreshness(
        [platform],
        isSingleDay ? startDate : undefined,
        isSingleDay ? data : data.slice(-1),
        latest.filter(row => row.platform === platform),
      );
      return NextResponse.json({ platform, data, freshness });
    }

    const platforms = await getAllSocialPlatforms();
    if (platforms.length === 0) {
      return NextResponse.json({ platforms: [], social: [] });
    }

    const [allData, latest] = await Promise.all([
      Promise.all(
      platforms.map(async (p) => {
        const data = await getSocialStatsByDateRange(startDate, endDate, p);
        return { platform: p, data };
      })),
      getLatestSocialStats(endDate),
    ]);

    const freshness = createPlatformFreshness(
      platforms,
      isSingleDay ? startDate : undefined,
      allData.flatMap(item => item.data),
      latest,
    );
    const social = allData.flatMap(({ platform, data }) => {
      const fallback = freshness[platform].data;
      return data.length || !fallback ? data : [fallback];
    });
    return NextResponse.json({ platforms, social, freshness });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching social data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
