import { NextResponse } from 'next/server';
import { saveManualData, getManualData, saveSocialStats, saveArticleStats, getToday } from '@/lib/db';

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
      await saveSocialStats({
        date,
        platform,
        followers: metric === 'followers' ? value : 0,
        posts: metric === 'posts' ? value : 0,
        views: metric === 'views' ? value : 0,
        likes: metric === 'likes' ? value : 0,
        shares: metric === 'shares' ? value : 0,
        comments: metric === 'comments' ? value : 0,
        subscribers: metric === 'subscribers' ? value : 0,
        video_views: metric === 'video_views' ? value : 0,
      });
    } else if (category === 'article' && platform) {
      await saveArticleStats({
        date,
        platform,
        article_count: metric === 'article_count' ? value : 0,
        total_views: metric === 'total_views' ? value : 0,
        avg_views: metric === 'avg_views' ? value : 0,
        likes: metric === 'likes' ? value : 0,
        bookmarks: metric === 'bookmarks' ? value : 0,
        comments: metric === 'comments' ? value : 0,
        followers: metric === 'followers' ? value : 0,
        new_articles: metric === 'new_articles' ? value : 0,
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
