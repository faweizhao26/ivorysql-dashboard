import { NextResponse } from 'next/server';
import { getSocialStatsByDateRange, getLatestSocialStats, getAllSocialPlatforms } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const startDateParam = searchParams.get('start');
  const isSingleDay = startDateParam === endDate;

  let startDate: string;
  if (startDateParam) {
    startDate = startDateParam;
  } else {
    const days = parseInt(searchParams.get('days') || '30', 10);
    const d = new Date();
    d.setDate(d.getDate() - days);
    startDate = d.toISOString().split('T')[0];
  }

  const platform = searchParams.get('platform');

  try {
    if (platform) {
      const data = await getSocialStatsByDateRange(startDate, endDate, platform);
      return NextResponse.json({ platform, data });
    }

    const platforms = await getAllSocialPlatforms();
    if (platforms.length === 0) {
      return NextResponse.json({ platforms: [], social: [] });
    }

    const allData = await Promise.all(
      platforms.map(async (p) => {
        const data = await getSocialStatsByDateRange(startDate, endDate, p);
        return { platform: p, data };
      })
    );

    // Fill in latest data for platforms with no data in range
    const social = await Promise.all(
      allData.map(async ({ platform: p, data }) => {
        if (data.length > 0) return data;
        const rangeData = await getSocialStatsByDateRange(startDate, endDate, p);
        if (rangeData.length > 0) return rangeData;
        const latest = await getSocialStatsByDateRange('2020-01-01', endDate, p);
        return latest.slice(-1); // latest single row
      })
    );

    return NextResponse.json({
      platforms,
      social: social.flat()
    });
  } catch (error) {
    console.error('Error fetching social data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
