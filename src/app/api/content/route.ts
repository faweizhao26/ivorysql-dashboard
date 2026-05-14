import { NextResponse } from 'next/server';
import { getArticleStatsByDateRange, getLatestArticleStats, getAllArticlePlatforms } from '@/lib/db';

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
      const data = await getArticleStatsByDateRange(startDate, endDate, platform);
      return NextResponse.json({ platform, data });
    }

    const platforms = await getAllArticlePlatforms();
    const allData = await Promise.all(
      platforms.map(async (p) => {
        const data = await getArticleStatsByDateRange(startDate, endDate, p);
        return { platform: p, data };
      })
    );

    let articles = allData.flatMap(d => d.data);

    if (articles.length === 0 && isSingleDay) {
      const latest = await getLatestArticleStats();
      articles = latest;
      return NextResponse.json({ platforms, articles, isFallback: true, fallbackDate: startDate });
    }

    return NextResponse.json({ platforms, articles });
  } catch (error) {
    console.error('Error fetching content data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
