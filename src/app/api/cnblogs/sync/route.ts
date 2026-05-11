import { NextResponse } from 'next/server';
import { saveArticleDetails, recalculateArticleStatsForDate, deleteArticleDetailsByDate } from '@/lib/db';

const PLATFORM = 'cnblogs';

function extractArticles(html: string) {
  const articles: { title: string; link: string; views: number; date: string }[] = [];

  const dayBlocks = html.match(/<div class="day"[^>]*>[\s\S]*?(?=<div class="day"|$)/g);
  if (!dayBlocks) return articles;

  for (const block of dayBlocks) {
    const dayDateMatch = block.match(/<a[^>]*>(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const dayDate = dayDateMatch
      ? `${dayDateMatch[1]}-${dayDateMatch[2].padStart(2, '0')}-${dayDateMatch[3].padStart(2, '0')}`
      : '';

    const postMatches = block.matchAll(/<a class="postTitle2[^"]*" href="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>/g);

    let lastIndex = 0;
    for (const postMatch of postMatches) {
      const link = postMatch[1];
      const title = postMatch[2].trim();
      const postIndex = postMatch.index;

      const postDescSection = block.substring(postIndex);
      const postedMatch = postDescSection.match(/posted\s*@\s*(\d{4}-\d{2}-\d{2})/);
      const date = postedMatch ? postedMatch[1] : dayDate;

      const viewMatch = postDescSection.match(/class="post-view-count"[^>]*>\s*阅读\((\d+)\)/);
      const views = viewMatch ? parseInt(viewMatch[1]) : 0;

      if (title && link) {
        articles.push({ title, link, views, date });
      }
    }
  }

  return articles;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  });
  return res.text();
}

export async function scrapeCnblogs(username: string = 'ivorysql'): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = 'https://www.cnblogs.com/' + username;

  console.log('Starting cnblogs sync for user: ' + username);

  try {
    const allArticles: { title: string; link: string; views: number; date: string }[] = [];

    for (let page = 1; page <= 5; page++) {
      const url = page === 1 ? baseUrl : baseUrl + '?page=' + page;
      const html = await fetchPage(url);
      const articles = extractArticles(html);

      if (articles.length === 0) break;
      allArticles.push(...articles);
      await new Promise(r => setTimeout(r, 500));
    }

    if (allArticles.length === 0) {
      return { success: true, articles: 0 };
    }

    const datesSet = new Set(allArticles.map(a => a.date).filter(Boolean));

    // Delete old article_details for the dates we are syncing
    await Promise.all(Array.from(datesSet).map(date =>
      deleteArticleDetailsByDate(PLATFORM, date)
    ));

    let saved = 0;
    for (const article of allArticles) {
      try {
        await saveArticleDetails({
          date: article.date || new Date().toISOString().split('T')[0],
          platform: PLATFORM,
          article_title: article.title,
          article_url: article.link,
          views: article.views,
          likes: 0,
          comments: 0
        });
        saved++;
      } catch (err: any) {
        console.error('Error saving article:', err.message);
      }
    }

    await Promise.all(Array.from(datesSet).map(date =>
      recalculateArticleStatsForDate(PLATFORM, date)
    ));

    console.log('cnblogs sync complete: ' + saved + ' articles saved');
    return { success: true, articles: saved };
  } catch (error: any) {
    console.error('cnblogs sync error:', error);
    return { success: false, error: error.message };
  }
}

export async function POST() {
  try {
    const result = await scrapeCnblogs();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('cnblogs sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync cnblogs data' }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
