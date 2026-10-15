import { isArticleDate } from './content-values.mjs';
export { normalizeMetric } from './content-values.mjs';
import { normalizeMetric } from './content-values.mjs';

export const ARTICLE_SYNC_LIMIT = 50;

export interface SyncedArticle {
  title: string;
  url: string;
  date: string;
  views?: number;
  likes?: number;
  comments?: number;
}

interface JuejinArticleInfo {
  title?: string;
  ctime?: string | number;
  view_count?: number;
  digg_count?: number;
  comment_count?: number;
}

interface JuejinResponse {
  data?: Array<{ article_id?: string; article_info?: JuejinArticleInfo }>;
  cursor?: string;
  has_more?: boolean;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!--\s*-->/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(value: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return undefined;
}

export function prepareRecentArticles(
  articles: SyncedArticle[],
  limit: number = ARTICLE_SYNC_LIMIT,
): SyncedArticle[] {
  const seen = new Set<string>();
  const result: SyncedArticle[] = [];

  for (const article of articles) {
    const url = article.url?.trim();
    const title = article.title?.trim();
    if (!url || !title || seen.has(url)) continue;
    if (!isArticleDate(article.date)) throw new RangeError(`Invalid publication date for ${url}`);
    seen.add(url);
    result.push({ ...article, title, url });
    if (result.length >= limit) break;
  }

  return result;
}

export function parseJuejinResponse(payload: JuejinResponse): {
  articles: SyncedArticle[];
  cursor: string;
  hasMore: boolean;
} {
  const articles = (payload.data || []).flatMap(item => {
    const id = item.article_id;
    const info = item.article_info;
    if (!id || !info?.title || !info.ctime) return [];

    const date = new Date(Number(info.ctime) * 1000).toISOString().slice(0, 10);
    return [{
      title: info.title,
      url: `https://juejin.cn/post/${id}`,
      date,
      views: normalizeMetric(info.view_count),
      likes: normalizeMetric(info.digg_count),
      comments: normalizeMetric(info.comment_count),
    }];
  });

  return {
    articles,
    cursor: payload.cursor || '',
    hasMore: payload.has_more === true,
  };
}

export function parseSegmentFaultArticle(html: string, url: string): SyncedArticle | null {
  const title = firstMatch(html, [
    /<h1[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h1>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const date = html.match(/<time[^>]+dateTime=["'](\d{4}-\d{2}-\d{2})/i)?.[1];
  const views = normalizeMetric(
    html.match(/<span[^>]*>\s*阅读(?:\s*<!--\s*-->)?\s*([\d,.万wk]+)/i)?.[1],
  );

  if (!title || !date || views === undefined) return null;
  return { title, url, date, views };
}

export function parseModbArticle(html: string, url: string): SyncedArticle | null {
  const title = firstMatch(html, [
    /(?:title|name):["']([^"']+)["'][\s\S]*?createdTime:/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const date = html.match(/createdTime:["'](\d{4}-\d{2}-\d{2})/i)?.[1];
  const views = normalizeMetric(html.match(/\bviews:(\d+)/i)?.[1]);
  const likes = normalizeMetric(html.match(/\blikes:(\d+)/i)?.[1]);
  const comments = normalizeMetric(html.match(/\bcommentCount:(\d+)/i)?.[1]);

  if (!title || !date || views === undefined) return null;
  return { title, url, date, views, likes, comments };
}

export async function fetchSyncJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'User-Agent': 'IvorySQL-Dashboard/1.0',
      Accept: 'application/json,text/plain,*/*',
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchSyncHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  return response.text();
}
