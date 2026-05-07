import { NextResponse } from 'next/server';
import { saveManualData, getManualData, saveSocialStats, saveArticleStats, getToday, getSocialStatsForDate, getArticleStatsForDate } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const days = parseInt(searchParams.get('days') || '90', 10);

  try {
    const data = await getManualData(category, days);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching manual data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, category, platform, metric, value, notes } = body;

    if (!date || !category || !metric || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: date, category, metric, value' },
        { status: 400 }
      );
    }

    if (category === 'social' && platform) {
      const existing = await getSocialStatsForDate(date);
      const prev = existing.find(s => s.platform === platform);

      await saveSocialStats({
        date,
        platform,
        followers: metric === 'followers' ? value : (prev?.followers || 0),
        posts: metric === 'posts' ? value : (prev?.posts || 0),
        views: metric === 'views' ? value : (prev?.views || 0),
        likes: metric === 'likes' ? value : (prev?.likes || 0),
        shares: metric === 'shares' ? value : (prev?.shares || 0),
        comments: metric === 'comments' ? value : (prev?.comments || 0),
        subscribers: metric === 'subscribers' ? value : (prev?.subscribers || 0),
        video_views: metric === 'video_views' ? value : (prev?.video_views || 0),
      });
    } else if (category === 'article' && platform) {
      const existing = await getArticleStatsForDate(date);
      const prev = existing.find(s => s.platform === platform);

      await saveArticleStats({
        date,
        platform,
        article_count: metric === 'article_count' ? value : (prev?.article_count || 0),
        total_views: metric === 'total_views' ? value : (prev?.total_views || 0),
        avg_views: metric === 'avg_views' ? value : (prev?.avg_views || 0),
        likes: metric === 'likes' ? value : (prev?.likes || 0),
        bookmarks: metric === 'bookmarks' ? value : (prev?.bookmarks || 0),
        comments: metric === 'comments' ? value : (prev?.comments || 0),
        followers: metric === 'followers' ? value : (prev?.followers || 0),
        new_articles: metric === 'new_articles' ? value : (prev?.new_articles || 0),
      });
    } else {
      await saveManualData({
        date,
        category,
        metric: platform ? `${platform}_${metric}` : metric,
        value,
        notes
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving manual data:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
