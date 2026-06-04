import { NextResponse } from 'next/server';
import { getWebsiteStatsForDate, getToday } from '@/lib/db';

const UMAMI_TOKEN = process.env.UMAMI_TOKEN;
const UMAMI_API = 'https://cloud.umami.is/api';
const WEBSITE_DOMAIN = 'ivorysql.org';

async function umamiFetch(endpoint: string) {
  const res = await fetch(`${UMAMI_API}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${UMAMI_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Umami API error: ${res.status}`);
  return res.json();
}

export async function GET() {
  if (!UMAMI_TOKEN) {
    return NextResponse.json({ error: 'UMAMI_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Get website list
    const websites = await umamiFetch('/websites');
    const site = websites.data.find((w: any) => w.domain === WEBSITE_DOMAIN);
    if (!site) {
      return NextResponse.json({ error: `Website ${WEBSITE_DOMAIN} not found in Umami` }, { status: 404 });
    }

    const today = getToday();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const startStr = startDate.getTime();

    // Get stats
    const stats = await umamiFetch(
      `/websites/${site.id}/stats?startAt=${startStr}&endAt=${Date.now()}`
    );

    // Get pageview data from Umami and save to DB
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    // Fetch daily pageviews for the last 90 days
    const pageviews = await umamiFetch(
      `/websites/${site.id}/pageviews?startAt=${startStr}&endAt=${Date.now()}&unit=day`
    );

    // Get top pages, sources, keywords in parallel
    const [metrics, sources] = await Promise.all([
      umamiFetch(`/websites/${site.id}/metrics?startAt=${startStr}&endAt=${Date.now()}&type=url`).catch(() => ({ data: [] })),
      umamiFetch(`/websites/${site.id}/metrics?startAt=${startStr}&endAt=${Date.now()}&type=referrer`).catch(() => ({ data: [] })),
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
      websiteId: site.id,
      siteName: site.name,
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
