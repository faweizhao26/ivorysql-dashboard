import { NextResponse } from 'next/server';

const PLATFORM = 'cnblogs';

function extractArticles(html: string, fullHtml: string) {
  const articles: { title: string; link: string; views: number; date: string }[] = [];
  
  const titleMatches = html.matchAll(/<a class="postTitle2[^"]*" href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g);
  
  for (const match of titleMatches) {
    const link = match[1];
    const title = match[2].trim();
    
    const dateMatch = fullHtml.substring(fullHtml.indexOf(match[0]) - 500, fullHtml.indexOf(match[0])).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    
    let date = '';
    if (dateMatch) {
      date = dateMatch[1] + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0');
    }
    
    const viewMatch = fullHtml.substring(fullHtml.indexOf(match[0]), fullHtml.indexOf(match[0]) + 1000).match(/class="post-view-count"[^>]*>阅读\((\d+)\)/);
    const views = viewMatch ? parseInt(viewMatch[1]) : 0;
    
    if (title && link) {
      articles.push({ title, link, views, date });
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
      const articles = extractArticles(html, html);
      
      if (articles.length === 0) break;
      allArticles.push(...articles);
      await new Promise(r => setTimeout(r, 500));
    }

    if (allArticles.length === 0) {
      return { success: true, articles: 0 };
    }

    const { saveArticleDetails, recalculateArticleStatsForDate } = require('@/lib/db');
    let saved = 0;
    const datesSet = new Set<string>();

    for (const article of allArticles) {
      try {
        saveArticleDetails({
          date: article.date || new Date().toISOString().split('T')[0],
          platform: PLATFORM,
          article_title: article.title,
          article_url: article.link,
          views: article.views,
          likes: 0,
          comments: 0
        });
        const dateKey = article.date.split(' ')[0];
        if (dateKey) datesSet.add(dateKey);
        saved++;
      } catch (err: any) {
        if (!err.message.includes('UNIQUE')) {
          console.error('Error saving article:', err.message);
        }
      }
    }

    datesSet.forEach(date => {
      recalculateArticleStatsForDate(PLATFORM, date);
    });

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
  return NextResponse.json({
    platform: 'cnblogs',
    username: 'ivorysql',
    configured: true
  });
}