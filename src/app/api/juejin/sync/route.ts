import { NextResponse } from 'next/server';
import { persistSyncedArticles } from '@/lib/article-sync';
import {
  ARTICLE_SYNC_LIMIT,
  fetchSyncJson,
  parseJuejinResponse,
  type SyncedArticle,
} from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';

const PLATFORM = 'juejin';
const USER_ID = process.env.JUEJIN_USER_ID || '761327331579511';
const API_URL = 'https://api.juejin.cn/content_api/v1/article/query_list?aid=2608&spider=0';

interface JuejinApiResponse {
  err_no?: number;
  err_msg?: string;
  data?: Array<{
    article_id?: string;
    article_info?: {
      title?: string;
      ctime?: string;
      view_count?: number;
      digg_count?: number;
      comment_count?: number;
    };
  }>;
  cursor?: string;
  has_more?: boolean;
}

export async function scrapeJuejin(): Promise<{
  success: boolean;
  articles?: number;
  error?: string;
}> {
  try {
    const articles: SyncedArticle[] = [];
    let cursor = '0';

    while (articles.length < ARTICLE_SYNC_LIMIT) {
      const payload = await fetchSyncJson<JuejinApiResponse>(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, sort_type: 2, cursor }),
      });
      if (payload.err_no !== 0) {
        throw new Error(payload.err_msg || 'Juejin API returned an error');
      }

      const page = parseJuejinResponse(payload);
      articles.push(...page.articles);
      if (!page.hasMore || !page.cursor || page.cursor === cursor) break;
      cursor = page.cursor;
    }

    return await persistSyncedArticles(PLATFORM, articles);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Juejin sync error:', message);
    return { success: false, error: message };
  }
}

export async function POST() {
  const result = await scrapeJuejin();
  return NextResponse.json(result, { status: getSyncHttpStatus(result) });
}

export async function GET() {
  return POST();
}
