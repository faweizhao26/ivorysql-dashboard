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
    const allData = await Promise.all(
      platforms.map(async (p) => {
        const data = await getSocialStatsByDateRange(startDate, endDate, p);
        return { platform: p, data };
      })
    );

    let social = allData.flatMap(d => d.data);

    // If no data for the selected range, fall back to latest data per platform
    if (social.length === 0 && isSingleDay) {
      const latest = await getLatestSocialStats();
      social = latest;
      return NextResponse.json({ platforms, social, isFallback: true, fallbackDate: startDate });
    }

    return NextResponse.json({ platforms, social });
  } catch (error) {
    console.error('Error fetching social data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
