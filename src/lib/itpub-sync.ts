import { persistSyncedArticles } from '@/lib/article-sync';
import { ARTICLE_SYNC_LIMIT } from '@/lib/content-sync';

const PLATFORM = 'itpub';

function decodeText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseItpubArticles(html: string) {
  const articles: { title: string; link: string; views?: number; date: string }[] = [];
  const listItems = html.match(/<li[^>]*class=["'][^"']*list-item[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) || [];
  
  for (const item of listItems) {
    const linkMatch = item.match(/href=["']((?:https:\/\/blog\.itpub\.net)?\/\d+\/viewspace-\d+\/)["']/i);
    const titleMatch = item.match(/<p[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
      || item.match(/<a[^>]*class=["'][^"']*article-title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    const viewsMatch = item.match(/icon-browse[^>]*>([^<]*)</i)
      || item.match(/浏览\s*([^<]*)</i);
    const dateMatch = item.match(/colorbb[^>]*>([^<]+)<\/span>/i)
      || item.match(/<time[^>]*>([^<]+)<\/time>/i)
      || item.match(/(\d{4}-\d{2}-\d{2})/);
    
    if (titleMatch && linkMatch) {
      const title = decodeText(titleMatch[1]);
      const link = new URL(linkMatch[1], 'https://blog.itpub.net').toString();
      const viewsText = viewsMatch?.[1].trim();
      const count = viewsText && /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(viewsText)
        ? Number(viewsText.replace(/,/g, '')) : undefined;
      const views = Number.isSafeInteger(count) ? count : undefined;
      const date = dateMatch ? dateMatch[1].trim().slice(0, 10) : '';
      
      articles.push({ title, link, views, date });
    }
  }
  
  return articles;
}

export function solveItpubGuard(guard: string): string {
  if (!/^[\w-]{13,}$/.test(guard)) throw new Error('Invalid ITPUB guard value');
  const key = guard.slice(0, 8);
  const numberValue = Number.parseInt(guard.slice(12), 10);
  if (!Number.isFinite(numberValue)) throw new Error('Invalid ITPUB guard value');
  const text = String(numberValue * 2 + 16);
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i] + key.charCodeAt(i % key.length)) % 256;
    [state[i], state[j]] = [state[j], state[i]];
  }
  let i = 0;
  j = 0;
  const encrypted: number[] = [];
  for (const character of text) {
    i = (i + 1) % 256;
    j = (j + state[i]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
    encrypted.push(character.charCodeAt(0) ^ state[(state[i] + state[j]) % 256]);
  }
  return Buffer.from(encrypted).toString('base64');
}

async function fetchItpubHtml(url: string): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };
  const first = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000), headers });
  if (!first.ok) throw new Error(`ITPUB returned HTTP ${first.status}`);
  const firstHtml = await first.text();
  if (!firstHtml.includes('/_guard/auto.js')) return firstHtml;

  const guard = first.headers.get('set-cookie')?.match(/(?:^|;\s*)guard=([^;]+)/)?.[1];
  if (!guard) throw new Error('ITPUB browser challenge did not provide a guard cookie');
  const guardret = solveItpubGuard(guard);
  const second = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
    headers: { ...headers, Cookie: `guard=${guard}; guardret=${guardret}` },
  });
  if (!second.ok) throw new Error(`ITPUB challenge retry returned HTTP ${second.status}`);
  const html = await second.text();
  if (html.includes('/_guard/auto.js')) throw new Error('ITPUB browser challenge could not be completed');
  return html;
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
    const html = await fetchItpubHtml(baseUrl);
    const articles = parseItpubArticles(html);
    const totalPages = extractTotalPages(html);
    
    console.log(`Found ${articles.length} articles on page 1, total pages: ${totalPages}`);

    const allArticles = [...articles];
    
    for (let page = 2; page <= totalPages && allArticles.length < ARTICLE_SYNC_LIMIT; page++) {
      console.log(`Fetching page ${page}/${totalPages}...`);
      const pageHtml = await fetchItpubHtml(`${baseUrl}/list/${page}/`);
      const pageArticles = parseItpubArticles(pageHtml);
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
