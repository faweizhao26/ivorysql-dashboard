import { NextResponse } from 'next/server';
import { 
  getArticleDetailsByPlatform, 
  getArticleDetailsForDate,
  getLatestArticleDetails,
  saveArticleDetails,
  deleteArticleDetails,
  getAllArticleDetailsPlatforms,
  updateReminderLastUpdated,
  updateArticleDetails,
  recalculateArticleStatsForDate,
  getArticleDetailsById
} from '@/lib/db';

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
  const fetchAll = searchParams.get('all') === 'true';
  const isSingleDay = startDate === endDate && startDateParam !== null;

  try {
    if (platform) {
      if (fetchAll) {
        const data = await getArticleDetailsByPlatform(platform, 365);
        return NextResponse.json({ 
          platform, 
          data,
          isArchive: false
        });
      }
      if (isSingleDay) {
        const data = await getArticleDetailsForDate(startDate);
        const latest = await getLatestArticleDetails(platform);
        return NextResponse.json({ 
          platform, 
          data,
          latest,
          isArchive: isSingleDay,
          archiveDate: startDate
        });
      }
      const data = await getArticleDetailsByPlatform(platform, 365);
      const filtered = data.filter((d: any) => d.date >= startDate && d.date <= endDate);
      return NextResponse.json({ platform, data: filtered });
    }

    const platforms = await getAllArticleDetailsPlatforms();
    const allData: Record<string, any[]> = {};
    
    for (const p of platforms) {
      const data = await getArticleDetailsByPlatform(p, 365);
      if (data.length > 0) {
        allData[p] = data;
      }
    }

    return NextResponse.json({
      platforms,
      articles: allData
    });
  } catch (error) {
    console.error('Error fetching article details:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, platform, article_title, article_url, views, likes, comments } = body;

    if (!date || !platform || !article_title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await saveArticleDetails({
      date,
      platform,
      article_title,
      article_url,
      views: views || 0,
      likes: likes || 0,
      comments: comments || 0
    });

    await recalculateArticleStatsForDate(platform, date);
    await updateReminderLastUpdated(platform);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving article details:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, date, platform, article_title, article_url, views, likes, comments } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing article id' }, { status: 400 });
    }

    const oldArticle = await getArticleDetailsById(id);
    if (!oldArticle) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    await updateArticleDetails(id, {
      date,
      platform,
      article_title,
      article_url,
      views,
      likes,
      comments
    });

    await recalculateArticleStatsForDate(platform, date);
    if (oldArticle.date !== date || oldArticle.platform !== platform) {
      await recalculateArticleStatsForDate(oldArticle.platform, oldArticle.date);
    }
    await updateReminderLastUpdated(platform);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating article details:', error);
    return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing article id' }, { status: 400 });
    }

    const article = await getArticleDetailsById(parseInt(id));
    await deleteArticleDetails(parseInt(id));
    
    if (article) {
      await recalculateArticleStatsForDate(article.platform, article.date);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting article details:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}