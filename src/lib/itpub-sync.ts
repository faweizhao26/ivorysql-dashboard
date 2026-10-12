import { persistSyncedArticles } from '@/lib/article-sync';
import { ARTICLE_SYNC_LIMIT, fetchSyncHtml } from '@/lib/content-sync';

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

export async function scrapeITPub(userId: string): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = `https://blog.itpub.net/${userId}`;
  
  console.log(`Starting ITPub sync for user: ${userId}`);

  try {
    const html = await fetchSyncHtml(baseUrl);
    const articles = extractArticles(html);
    const totalPages = extractTotalPages(html);
    
    console.log(`Found ${articles.length} articles on page 1, total pages: ${totalPages}`);

    const allArticles = [...articles];
    
    for (let page = 2; page <= totalPages && allArticles.length < ARTICLE_SYNC_LIMIT; page++) {
      console.log(`Fetching page ${page}/${totalPages}...`);
      const pageHtml = await fetchSyncHtml(`${baseUrl}/list/${page}/`);
      const pageArticles = extractArticles(pageHtml);
      allArticles.push(...pageArticles);
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`Total articles collected: ${allArticles.length}`);

    return await persistSyncedArticles(PLATFORM, allArticles.map(article => ({
      title: article.title,
      url: article.link,
      date: article.date.split(' ')[0],
      views: article.views,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ITPub sync error:', message);
    return { success: false, error: message };
  }
}
