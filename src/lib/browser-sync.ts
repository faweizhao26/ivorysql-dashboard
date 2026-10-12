import { timingSafeEqual } from 'node:crypto';
import type { SyncedArticle } from './content-sync';

export const BROWSER_SYNC_PLATFORMS = [
  'oschina',
  'ctoutiao',
  'toutiao',
  'zhihu',
] as const;

type BrowserSyncPlatform = typeof BROWSER_SYNC_PLATFORMS[number];

function isPlatform(value: unknown): value is BrowserSyncPlatform {
  return typeof value === 'string'
    && BROWSER_SYNC_PLATFORMS.includes(value as BrowserSyncPlatform);
}

function readMetric(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : undefined;
}

export function parseBrowserSyncPayload(input: unknown): {
  platform: BrowserSyncPlatform;
  articles: SyncedArticle[];
} {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid browser sync payload');
  }

  const payload = input as Record<string, unknown>;
  if (!isPlatform(payload.platform)) {
    throw new Error('Unsupported browser sync platform');
  }
  if (!Array.isArray(payload.articles)) {
    throw new Error('Browser sync articles must be an array');
  }

  const articles = payload.articles.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const article = item as Record<string, unknown>;
    const title = typeof article.title === 'string' ? article.title.trim() : '';
    const url = typeof article.url === 'string' ? article.url.trim() : '';
    const date = typeof article.date === 'string' ? article.date.trim() : '';
    if (!title || !url || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

    return [{
      title,
      url,
      date,
      views: readMetric(article.views),
      likes: readMetric(article.likes),
      comments: readMetric(article.comments),
    }];
  });

  if (articles.length === 0) {
    throw new Error('No valid browser sync articles were provided');
  }

  return { platform: payload.platform, articles };
}

export function isBrowserSyncAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!authorization || !secret) return false;
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}
