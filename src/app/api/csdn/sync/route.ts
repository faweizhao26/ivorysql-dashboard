import { NextResponse } from 'next/server';

const PLATFORM = 'csdn';

function parseCSDNDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const now = new Date();
  dateStr = dateStr.trim();
  
  if (dateStr.includes('小时前') || dateStr.includes('hours ago')) {
    const hours = parseInt(dateStr.match(/(\d+)/)?.[1] || '0');
    const d = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (dateStr.includes('昨天')) {
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (dateStr.includes('前天')) {
    const d = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
  
  const match = dateStr.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
  if (match) {
    return match[1] + '-' + match[2] + '-' + match[3];
  }
  
  return new Date().toISOString().split('T')[0];
}

function extractArticles(html: string) {
  const articles: { title: string; link: string; views: number; date: string }[] = [];
  
  const articleBlocks = html.match(/<article class="blog-list-box"([\s\S]*?)<\/article>/g) || [];
  
  for (const block of articleBlocks) {
    const titleMatch = block.match(/<h4[^>]*>([^<]+)<\/h4>/);
    const linkMatch = block.match(/href="(https:\/\/blog\.csdn\.net\/[^"]+article\/details\/[^"]+)"/);
    const viewsMatch = block.match(/view-num[^>]*>\s*([^<]+)<span[^>]*>\s*阅读/);
    const dateMatch = block.match(/博文更新于\s*([^<]+)</);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1];
      
      let views = 0;
      if (viewsMatch) {
        const viewsStr = viewsMatch[1].replace(/[^\d]/g, '');
        views = parseInt(viewsStr) || 0;
      }
      
      let date = '';
      if (dateMatch) {
        date = parseCSDNDate(dateMatch[1]);
      }
      
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

export async function scrapeCSDN(username: string = 'IvorySQL'): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = `https://blog.csdn.net/${username}`;
  
  console.log(`Starting CSDN sync for user: ${username}`);

  try {
    const html = await fetchPage(baseUrl);
    const articles = extractArticles(html);
    
    console.log(`Found ${articles.length} articles`);

    if (articles.length === 0) {
      return { success: true, articles: 0 };
    }

    const { saveArticleDetails, recalculateArticleStatsForDate } = require('@/lib/db');
    let saved = 0;
    const datesSet = new Set<string>();

    for (const article of articles) {
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

    console.log(`CSDN sync complete: ${saved} articles saved`);

    return { success: true, articles: saved };
  } catch (error: any) {
    console.error('CSDN sync error:', error);
    return { success: false, error: error.message };
  }
}

export async function POST() {
  try {
    const result = await scrapeCSDN();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('CSDN sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync CSDN data' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    platform: 'csdn',
    username: 'IvorySQL',
    configured: true,
    note: 'CSDN has anti-scraping protection. Only recent articles (first page) can be fetched.'
  });
}