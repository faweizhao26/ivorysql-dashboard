import { NextResponse } from 'next/server';
import { persistSyncedArticles } from '@/lib/article-sync';
import { fetchSyncHtml } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';

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

  const match = dateStr.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (match) {
    return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
  }

  return new Date().toISOString().split('T')[0];
}

function extractArticles(html: string) {
  const articles: { title: string; link: string; views: number; likes: number; comments: number; date: string }[] = [];

  const articleBlocks = html.match(/<article class="blog-list-box"[\s\S]*?<\/article>/g) || [];

  for (const block of articleBlocks) {
    const titleMatch = block.match(/<h4[^>]*>([^<]+)<\/h4>/);
    const linkMatch = block.match(/href="(https:\/\/blog\.csdn\.net\/[^"]+article\/details\/[^"]+)"/);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].trim();
    const link = linkMatch[1];

    const viewsMatch = block.match(/view-num[^>]*>(\d+)</);
    const views = viewsMatch ? parseInt(viewsMatch[1]) : 0;

    const likesMatch = block.match(/give-like-num[^>]*>(\d+)</);
    const likes = likesMatch ? parseInt(likesMatch[1]) : 0;

    const commentsMatch = block.match(/comment-num[^>]*>(\d+)</);
    const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

    const dateMatch = block.match(/博文更新于\s*[\d.]+\s*·/);
    let date = '';
    if (dateMatch) {
      date = parseCSDNDate(dateMatch[0]);
    }

    articles.push({ title, link, views, likes, comments, date });
  }

  return articles;
}

export async function scrapeCSDN(username: string = 'IvorySQL'): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  const baseUrl = `https://blog.csdn.net/${username}`;

  console.log(`Starting CSDN sync for user: ${username}`);

  try {
    const html = await fetchSyncHtml(baseUrl);
    const articles = extractArticles(html);

    console.log(`Found ${articles.length} articles`);

    return await persistSyncedArticles(PLATFORM, articles.map(article => ({
      title: article.title,
      url: article.link,
      date: article.date || new Date().toISOString().split('T')[0],
      views: article.views,
      likes: article.likes,
      comments: article.comments,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('CSDN sync error:', message);
    return { success: false, error: message };
  }
}

export async function POST() {
  const result = await scrapeCSDN();
  return NextResponse.json(result, { status: getSyncHttpStatus(result) });
}

export async function GET() {
  return POST();
}
