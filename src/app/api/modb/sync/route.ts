import { NextResponse } from 'next/server';
import { scrapeModb } from '@/lib/modb-sync';
import { refreshKnownArticleMetrics } from '@/lib/article-sync';
import { parseModbArticle } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';

const MODB_USER_ID = process.env.MODB_USER_ID || '471017';

export async function syncModb() {
  try {
    const social = await scrapeModb(MODB_USER_ID);
    if (!social.success) return social;
    const articles = await refreshKnownArticleMetrics('modb', parseModbArticle);
    return {
      success: true,
      stats: social.stats,
      articles: articles.articles,
      failed: articles.failed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('modb sync error:', message);
    return { success: false, error: message || 'Failed to sync modb data' };
  }
}

export async function POST() {
  const result = await syncModb();
  return NextResponse.json(result, { status: getSyncHttpStatus(result) });
}

export async function GET() {
  return POST();
}
