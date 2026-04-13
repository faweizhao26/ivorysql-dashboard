import {
  saveArticleDetails,
  recalculateArticleStatsForDate
} from '@/lib/db';

const PLATFORM = 'itpub';

function extractArticles(html: string) {
  const articles: { title: string; link: string; views: number; date: string }[] = [];
  const listItems = html.match(/<li class="list-item">([\s\S]*?)<\/li>/g) || [];
  
  for (const item of listItems) {
    const titleMatch = item.match(/<p class="title">([^<]+)<\/p>/);
    const linkMatch = item.match(/href="(https:\/\/blog\.itpub\.net\/\d+\/viewspace-\d+\/)"/);
    const viewsMatch = item.match(/icon-browse"[^>]*>([\d,]+)</);
    const dateMatch = item.match(/colorbb">([^<]+)<\/span>/);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1];
      const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : 0;
      const date = dateMatch ? dateMatch[1].trim() : '';
      
      articles.push({ title, link, views, date });
    }
  }
  
  return articles;
}

function extractTotalPages(html: string): number {
  const match = html.match(/last"[^>]*href="[^"]*\/list\/(\d+)\/"/);
  return match ? parseInt(match[1]) : 1;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });
  return res.text();
}

export async function scrapeITPub(userId: string): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = `https://blog.itpub.net/${userId}`;
  
  console.log(`Starting ITPub sync for user: ${userId}`);

  try {
    const html = await fetchPage(baseUrl);
    const articles = extractArticles(html);
    const totalPages = extractTotalPages(html);
    
    console.log(`Found ${articles.length} articles on page 1, total pages: ${totalPages}`);

    const allArticles = [...articles];
    
    for (let page = 2; page <= totalPages; page++) {
      console.log(`Fetching page ${page}/${totalPages}...`);
      const pageHtml = await fetchPage(`${baseUrl}/list/${page}/`);
      const pageArticles = extractArticles(pageHtml);
      allArticles.push(...pageArticles);
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`Total articles collected: ${allArticles.length}`);

    let saved = 0;
    const datesSet = new Set<string>();

    for (const article of allArticles) {
      try {
        saveArticleDetails({
          date: article.date,
          platform: PLATFORM,
          article_title: article.title,
          article_url: article.link,
          views: article.views,
          likes: 0,
          comments: 0
        });
        datesSet.add(article.date.split(' ')[0]);
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

    console.log(`ITPub sync complete: ${saved} articles saved`);

    return { success: true, articles: saved };
  } catch (error: any) {
    console.error('ITPub sync error:', error);
    return { success: false, error: error.message };
  }
}