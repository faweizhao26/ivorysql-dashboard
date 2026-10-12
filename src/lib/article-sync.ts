import {
  recalculateArticleStatsForDate,
  getRecentArticleDetailsByPlatform,
  saveSyncedArticleDetails,
  updateReminderLastUpdated,
  type SyncedArticleDetails,
} from './db';
import { prepareRecentArticles, type SyncedArticle } from './content-sync';
import { fetchSyncHtml } from './content-sync';

interface ArticleSyncDependencies {
  save: (article: SyncedArticleDetails) => Promise<void>;
  recalculate: (platform: string, date: string) => Promise<void>;
  markUpdated: (platform: string) => Promise<void>;
}

const defaultDependencies: ArticleSyncDependencies = {
  save: saveSyncedArticleDetails,
  recalculate: recalculateArticleStatsForDate,
  markUpdated: updateReminderLastUpdated,
};

export async function persistSyncedArticles(
  platform: string,
  articles: SyncedArticle[],
  dependencies: ArticleSyncDependencies = defaultDependencies,
): Promise<{ success: true; articles: number }> {
  const prepared = prepareRecentArticles(articles);
  if (prepared.length === 0) {
    throw new Error(`No valid ${platform} articles were returned`);
  }

  const dates = new Set<string>();
  for (const article of prepared) {
    await dependencies.save({
      date: article.date,
      platform,
      article_title: article.title,
      article_url: article.url,
      views: article.views,
      likes: article.likes,
      comments: article.comments,
    });
    dates.add(article.date);
  }

  await Promise.all(
    Array.from(dates, date => dependencies.recalculate(platform, date)),
  );
  await dependencies.markUpdated(platform);

  return { success: true, articles: prepared.length };
}

export async function refreshKnownArticleMetrics(
  platform: string,
  parser: (html: string, url: string) => SyncedArticle | null,
): Promise<{ success: true; articles: number; failed: number }> {
  const existing = await getRecentArticleDetailsByPlatform(platform);
  if (existing.length === 0) {
    throw new Error(`No existing ${platform} article URLs are available to refresh`);
  }

  const parsed: SyncedArticle[] = [];
  let failed = 0;
  const queue = [...existing];

  async function worker() {
    while (queue.length > 0) {
      const article = queue.shift();
      if (!article?.article_url) continue;
      try {
        const html = await fetchSyncHtml(article.article_url);
        const current = parser(html, article.article_url);
        if (current) parsed.push(current);
        else failed += 1;
      } catch (error) {
        failed += 1;
        console.warn(`${platform} article refresh failed:`, article.article_url, error);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
  const result = await persistSyncedArticles(platform, parsed);
  return { ...result, failed };
}
