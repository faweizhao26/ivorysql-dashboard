import { NextResponse } from 'next/server';
import { refreshKnownArticleMetrics } from '@/lib/article-sync';
import { parseSegmentFaultArticle } from '@/lib/content-sync';
import { getSyncHttpStatus } from '@/lib/sync-utils';

export async function syncSegmentFault(): Promise<{
  success: boolean;
  articles?: number;
  failed?: number;
  error?: string;
}> {
  try {
    return await refreshKnownArticleMetrics('sf', parseSegmentFaultArticle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('SegmentFault sync error:', message);
    return { success: false, error: message };
  }
}

export async function POST() {
  const result = await syncSegmentFault();
  return NextResponse.json(result, { status: getSyncHttpStatus(result) });
}

export async function GET() {
  return POST();
}
