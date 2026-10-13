import { NextResponse } from 'next/server';
import { getWebsiteStatsByDateRange, getLatestWebsiteStats, getWebsiteStatsForDate } from '@/lib/db';
import { createDataSlice } from '@/lib/data-slices';
import { getDataRangeParams } from '@/lib/date-query';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate, isSingleDay } = getDataRangeParams(
      searchParams,
      new Date().toISOString().split('T')[0],
    );
    let websiteData: any;
    let freshness;

    if (isSingleDay) {
      const [websiteForDate, fallback] = await Promise.all([
        getWebsiteStatsForDate(startDate),
        getLatestWebsiteStats(endDate),
      ]);
      const selected = websiteForDate || fallback;
      websiteData = {
        latest: selected,
        history: selected ? [selected] : [],
        isArchive: true,
        archiveDate: selected?.date || null,
      };
      freshness = createDataSlice(startDate, websiteForDate, fallback);
    } else {
      const [latest, history] = await Promise.all([
        getLatestWebsiteStats(endDate),
        getWebsiteStatsByDateRange(startDate, endDate)
      ]);
      websiteData = {
        latest,
        history,
        isArchive: false
      };
      freshness = createDataSlice(undefined, history.at(-1) || null, latest);
    }

    return NextResponse.json({
      website: websiteData,
      freshness,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching website data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
