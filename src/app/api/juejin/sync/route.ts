import { NextResponse } from 'next/server';
import { saveArticleDetails, recalculateArticleStatsForDate, deleteArticleDetailsByDate } from '@/lib/db';

const PLATFORM = 'juejin';
const USER_ID = '761327331579511';

function parseRelativeDate(dateStr: string): string {
  const now = new Date();
  if (dateStr.includes('天前')) {
    const days = parseInt(dateStr.match(/(\d+)天前/)?.[1] || '0');
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  if (dateStr.includes('小时前')) {
    const hours = parseInt(dateStr.match(/(\d+)小时前/)?.[1] || '0');
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  if (dateStr.includes('分钟前')) {
    const mins = parseInt(dateStr.match(/(\d+)分钟前/)?.[1] || '0');
    return new Date(now.getTime() - mins * 60 * 1000).toISOString().split('T')[0];
  }
  if (dateStr.includes('昨天')) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function extractArticles(html: string) {
  const articles: { title: string; link: string; views: number; likes: number; date: string }[] = [];

  const activityItems = html.match(/<div class="activity-item shadow"[^>]*>[\s\S]*?<div class="post-item content-item"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];

  for (const item of activityItems) {
    const titleMatch = item.match(/<h3[^>]*>[\s\S]*?([^<>\n]{3,})[\s]*<\/h3>/);
    const linkMatch = item.match(/href="(\/post\/\d+)"/);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].trim();
    const link = 'https://juejin.cn' + linkMatch[1];

    const dateMatch = item.match(/(\d+天前|\d+小时前|\d+分钟前|昨天)/);
    const date = dateMatch ? parseRelativeDate(dateMatch[1]) : new Date().toISOString().split('T')[0];

    const likesMatch = item.match(/"action-title">(\d+)</);
    const likes = likesMatch ? parseInt(likesMatch[1]) : 0;

    articles.push({ title, link, views: 0, likes, date });
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

export async function scrapeJuejin(): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = 'https://juejin.cn/user/' + USER_ID;

  console.log('Starting Juejin sync for user: ' + USER_ID);

  try {
    const allArticles: { title: string; link: string; views: number; likes: number; date: string }[] = [];

    for (let page = 1; page <= 5; page++) {
      const url = page === 1 ? baseUrl : baseUrl + '?page=' + page;
      const html = await fetchPage(url);
      const articles = extractArticles(html);

      if (articles.length === 0) break;
      allArticles.push(...articles);
      await new Promise(r => setTimeout(r, 800));
    }

    if (allArticles.length === 0) {
      return { success: true, articles: 0 };
    }

    const datesSet = new Set(allArticles.map(a => a.date).filter(Boolean));

    // Delete old data for dates being synced
    await Promise.all(Array.from(datesSet).map(date =>
      deleteArticleDetailsByDate(PLATFORM, date)
    ));

    let saved = 0;
    for (const article of allArticles) {
      try {
        await saveArticleDetails({
          date: article.date,
          platform: PLATFORM,
          article_title: article.title,
          article_url: article.link,
          views: article.views,
          likes: article.likes,
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

    console.log('Juejin sync complete: ' + saved + ' articles saved');
    return { success: true, articles: saved };
  } catch (error: any) {
    console.error('Juejin sync error:', error);
    return { success: false, error: error.message };
  }
}

export async function POST() {
  try {
    const result = await scrapeJuejin();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Juejin sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync Juejin data' }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
