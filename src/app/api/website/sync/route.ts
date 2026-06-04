import { NextResponse } from 'next/server';
import { getWebsiteStatsForDate, getToday } from '@/lib/db';

const UMAMI_TOKEN = process.env.UMAMI_TOKEN;
const UMAMI_API = 'https://cloud.umami.is';
const WEBSITE_ID = 'd0465d4e-0252-45bf-a99b-b12fe2ae0732';

async function umamiFetch(endpoint: string) {
  const url = `${UMAMI_API}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'x-umami-api-key': UMAMI_TOKEN!,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Umami API error: ${res.status} - ${text.substring(0, 150)}`);
  }
  return res.json();
}

export async function GET() {
  if (!UMAMI_TOKEN) {
    return NextResponse.json({ error: 'UMAMI_TOKEN not configured' }, { status: 500 });
  }

  try {
    const today = getToday();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const startStr = startDate.getTime();
    const endStr = Date.now();

    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    // Fetch daily pageviews
    const pageviews = await umamiFetch(
      `/api/websites/${WEBSITE_ID}/pageviews?startAt=${startStr}&endAt=${endStr}&unit=day`
    );

    // Get top pages, sources
    const [metrics, sources] = await Promise.all([
      umamiFetch(`/api/websites/${WEBSITE_ID}/metrics?startAt=${startStr}&endAt=${endStr}&type=url`).catch(() => ({ data: [] })),
      umamiFetch(`/api/websites/${WEBSITE_ID}/metrics?startAt=${startStr}&endAt=${endStr}&type=referrer`).catch(() => ({ data: [] })),
    ]);

    const topPages = (metrics.data || []).slice(0, 10).map((m: any) => m.x);
    const topSources = (sources.data || []).slice(0, 10).map((m: any) => m.x);

    // Save daily stats
    for (const pv of (pageviews.pageviews || [])) {
      const date = pv.t?.split(' ')[0]; // "2026-06-04 00:00"
      if (!date) continue;
      await pool.query(
        `INSERT INTO website_stats (date, pageviews, unique_visitors, top_pages, sources, keywords)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (date) DO UPDATE SET
           pageviews = EXCLUDED.pageviews,
           unique_visitors = EXCLUDED.unique_visitors,
           top_pages = EXCLUDED.top_pages,
           sources = EXCLUDED.sources`,
        [date, pv.y || 0, pv.u || 0, JSON.stringify(topPages), JSON.stringify(topSources), '[]']
      );
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      websiteId: WEBSITE_ID,
      daysSaved: (pageviews.pageviews || []).length,
      stats: {
        totalPageviews: pageviews.pageviews?.reduce((s: number, p: any) => s + (p.y || 0), 0) || 0,
        totalVisitors: pageviews.pageviews?.reduce((s: number, p: any) => s + (p.u || 0), 0) || 0,
      },
    });
  } catch (error: any) {
    console.error('Website sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
