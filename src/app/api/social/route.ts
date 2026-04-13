import { NextResponse } from 'next/server';
import { getSocialStatsByDateRange, getAllSocialPlatforms } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const startDateParam = searchParams.get('start');
  
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
      const data = await getSocialStatsByDateRange(startDate, endDate);
      return NextResponse.json({ platform, data });
    }

    const platforms = await getAllSocialPlatforms();
    const allData = await Promise.all(
      platforms.map(async (p) => {
        const data = await getSocialStatsByDateRange(startDate, endDate);
        return { platform: p, data };
      })
    );

    return NextResponse.json({
      platforms,
      social: allData.flatMap(d => d.data)
    });
  } catch (error) {
    console.error('Error fetching social data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
