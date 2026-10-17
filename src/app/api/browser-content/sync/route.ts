import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { persistSyncedArticles } from '@/lib/article-sync';
import { getAccessTokenSecret, readAccessToken } from '@/lib/auth';
import {
  isBrowserSyncPlatform,
  parseBrowserSyncFailure,
  parseBrowserSyncPayload,
} from '@/lib/browser-sync';
import { isMachineSyncAuthorized } from '@/lib/browser-sync-auth.mjs';
import { getArticleDetailsByPlatform } from '@/lib/db';
import { startSyncRun, finishSyncRun } from '@/lib/sync-runs';
import { runTrackedSync } from '@/lib/tracked-sync';

async function authorization(request: Request): Promise<'ego_lite' | 'manual' | null> {
  if (await isMachineSyncAuthorized(request.headers.get('authorization'), process.env.ADMIN_PASSWORD, process.env.CRON_SECRET)) {
    return 'ego_lite';
  }
  const cookieStore = await cookies();
  const accessPassword = process.env.ACCESS_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const accessLevel = accessPassword && adminPassword
    ? await readAccessToken(
        cookieStore.get('access_level')?.value,
        getAccessTokenSecret(accessPassword, adminPassword),
      )
    : null;

  return accessLevel === 'admin' ? 'manual' : null;
}

export async function GET(request: Request) {
  if (!await authorization(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const platform = new URL(request.url).searchParams.get('platform');
  if (platform === null) return NextResponse.json({ success: true, version: 1 });
  if (!isBrowserSyncPlatform(platform)) return NextResponse.json({ error: 'Unsupported browser sync platform' }, { status: 400 });
  try {
    const articles = await getArticleDetailsByPlatform(platform, 3650);
    return NextResponse.json({ success: true, dates: articles.filter(article => article.article_url).map(article => [article.article_url, article.date]) });
  } catch (error) {
    console.error('Browser sync dates error:', error);
    return NextResponse.json({ error: '历史文章日期读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const trigger = await authorization(request);
  if (!trigger) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let payload: unknown;
  let runId: number | undefined;
  try {
    payload = await request.json();
    if (payload && typeof payload === 'object' && 'status' in payload && payload.status === 'failed') {
      const failure = parseBrowserSyncFailure(payload);
      runId = await startSyncRun(failure.platform, trigger);
      await finishSyncRun(runId, { status: 'failed', recordsSeen: 0, recordsWritten: 0, errorMessage: failure.error });
      return NextResponse.json({ success: true, runId });
    }
    const { platform, articles } = parseBrowserSyncPayload(payload);
    const tracked = await runTrackedSync({
      platform,
      trigger,
      tracker: {
        async start(platform, trigger) {
          runId = await startSyncRun(platform, trigger);
          return runId;
        },
        finish: finishSyncRun,
      },
    }, async () => {
      const result = await persistSyncedArticles(platform, articles);
      return {
        value: result,
        recordsSeen: articles.length,
        recordsWritten: result.articles || 0,
      };
    });
    return NextResponse.json({ ...tracked.value, runId: tracked.runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Browser content sync error:', message);
    return NextResponse.json({ success: false, error: message, ...(runId ? { runId } : {}) }, { status: 400 });
  }
}
