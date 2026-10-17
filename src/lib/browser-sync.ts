import { timingSafeEqual } from 'node:crypto';
import type { SyncedArticle } from './content-sync';
import { isArticleDate, normalizeMetric } from './content-values.mjs';

export const BROWSER_SYNC_PLATFORMS = [
  'oschina',
  'ctoutiao',
  'toutiao',
  'zhihu',
] as const;

type BrowserSyncPlatform = typeof BROWSER_SYNC_PLATFORMS[number];

export function isBrowserSyncPlatform(value: unknown): value is BrowserSyncPlatform {
  return typeof value === 'string'
    && BROWSER_SYNC_PLATFORMS.includes(value as BrowserSyncPlatform);
}

function readMetric(value: unknown): number | undefined {
  return normalizeMetric(value);
}

export function parseBrowserSyncPayload(input: unknown): {
  platform: BrowserSyncPlatform;
  articles: SyncedArticle[];
} {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid browser sync payload');
  }

  const payload = input as Record<string, unknown>;
  if (!isBrowserSyncPlatform(payload.platform)) {
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
    if (!title || !url) return [];
    if (!isArticleDate(date)) throw new RangeError(`Invalid publication date for ${url}`);

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

export function parseBrowserSyncFailure(input: unknown): { platform: BrowserSyncPlatform; error: string } {
  const payload = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  if (!isBrowserSyncPlatform(payload.platform) || payload.status !== 'failed'
    || typeof payload.error !== 'string' || !payload.error.trim()) {
    throw new Error('Invalid browser sync failure');
  }
  return { platform: payload.platform, error: payload.error.trim().slice(0, 1000) };
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
