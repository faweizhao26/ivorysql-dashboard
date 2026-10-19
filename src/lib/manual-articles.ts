import { withDbTransaction, saveArticleDetails, updateArticleDetails, recalculateArticleStatsForDate, type ArticleDetails } from './db';

export class ArticleNotFoundError extends Error {}

type ArticleMutation = { type: 'create'; article: ArticleDetails }
  | { type: 'update'; id: number; article: Partial<ArticleDetails> }
  | { type: 'delete'; id: number };

export async function mutateManualArticle(mutation: ArticleMutation): Promise<void> {
  await withDbTransaction(async client => {
    const execute = (sql: string, values?: unknown[]) => client.query(sql, values);
    let previous: ArticleDetails | undefined;
    if (mutation.type !== 'create') {
      // Serialize manual edits of the same ID before choosing platform locks.
      await execute('SELECT pg_advisory_xact_lock(hashtext($1))', [`article-manual:${mutation.id}`]);
      previous = (await execute('SELECT * FROM article_details WHERE id = $1', [mutation.id])).rows[0];
      if (!previous) throw new ArticleNotFoundError('文章不存在或已被删除');
    }
    const targetPlatform = mutation.type === 'delete' ? previous!.platform : mutation.article.platform ?? previous!.platform;
    const platforms = [...new Set([targetPlatform, ...(previous ? [previous.platform] : [])])].sort();
    // Match automatic sync's lock order: platform first, then individual rows.
    for (const platform of platforms) await execute('SELECT pg_advisory_xact_lock(hashtext($1))', [`article-sync:${platform}`]);
    if (mutation.type !== 'create') {
      previous = (await execute('SELECT * FROM article_details WHERE id = $1 FOR UPDATE', [mutation.id])).rows[0];
      if (!previous) throw new ArticleNotFoundError('文章不存在或已被删除');
    } else if (mutation.article.article_url) {
      previous = (await execute('SELECT date, platform FROM article_details WHERE platform = $1 AND article_url = $2 FOR UPDATE', [targetPlatform, mutation.article.article_url])).rows[0];
    }

    const affected = new Map<string, { platform: string; date: string }>();
    if (previous) affected.set(`${previous.platform}:${previous.date}`, previous);
    if (mutation.type === 'delete') {
      await execute('DELETE FROM article_details WHERE id = $1', [mutation.id]);
    } else {
      if (mutation.type === 'create') await saveArticleDetails(mutation.article, execute);
      else await updateArticleDetails(mutation.id, mutation.article, execute);
      const date = mutation.article.date ?? previous!.date;
      affected.set(`${targetPlatform}:${date}`, { platform: targetPlatform, date });
    }
    for (const { platform, date } of [...affected.values()].sort((a, b) => `${a.platform}:${a.date}`.localeCompare(`${b.platform}:${b.date}`))) {
      await recalculateArticleStatsForDate(platform, date, execute);
    }
    for (const platform of platforms) {
      await execute('UPDATE reminder_settings SET last_data_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE platform = $1', [platform]);
    }
  });
}
