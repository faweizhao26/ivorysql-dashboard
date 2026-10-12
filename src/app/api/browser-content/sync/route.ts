import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { persistSyncedArticles } from '@/lib/article-sync';
import { getAccessTokenSecret, readAccessToken } from '@/lib/auth';
import {
  isBrowserSyncAuthorized,
  parseBrowserSyncPayload,
} from '@/lib/browser-sync';
import { runTrackedSync } from '@/lib/tracked-sync';

export async function POST(request: Request) {
  const cronAuthorized = isBrowserSyncAuthorized(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  );
  const cookieStore = await cookies();
  const accessPassword = process.env.ACCESS_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const accessLevel = accessPassword && adminPassword
    ? await readAccessToken(
        cookieStore.get('access_level')?.value,
        getAccessTokenSecret(accessPassword, adminPassword),
      )
    : null;

  if (!cronAuthorized && accessLevel !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { platform, articles } = parseBrowserSyncPayload(await request.json());
    const tracked = await runTrackedSync({
      platform,
      trigger: cronAuthorized ? 'ego_lite' : 'manual',
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
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
