import { NextResponse } from 'next/server';
import { getWebsiteStatsByDateRange, getLatestWebsiteStats, getWebsiteStatsForDate } from '@/lib/db';

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

  const isSingleDay = startDate === endDate && startDateParam !== null;

  try {
    let websiteData: any;

    if (isSingleDay) {
      const websiteForDate = await getWebsiteStatsForDate(startDate);
      websiteData = {
        latest: websiteForDate,
        history: websiteForDate ? [websiteForDate] : [],
        isArchive: true,
        archiveDate: startDate
      };
    } else {
      const [latest, history] = await Promise.all([
        getLatestWebsiteStats(),
        getWebsiteStatsByDateRange(startDate, endDate)
      ]);
      websiteData = {
        latest,
        history,
        isArchive: false
      };
    }

    return NextResponse.json({
      website: websiteData
    });
  } catch (error) {
    console.error('Error fetching website data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
