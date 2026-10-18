import { withDbTransaction, type SyncedArticleDetails } from './db';

export async function persistArticleSyncBatch(
  platform: string,
  articles: SyncedArticleDetails[],
  transaction: typeof withDbTransaction = withDbTransaction,
): Promise<void> {
  if (articles.length === 0) return;

  await transaction(async client => {
    // Different URLs can affect the same daily summary, so serialize per platform.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`article-sync:${platform}`]);
    const previous = await client.query<{ date: string }>(`
      SELECT date FROM article_details
      WHERE platform = $1 AND article_url = ANY($2::text[])
      FOR UPDATE
    `, [platform, articles.map(article => article.article_url)]);
    const oldDates = Array.from(new Set(previous.rows.map(article => article.date)));
    const dates = Array.from(new Set([...oldDates, ...articles.map(article => article.date)]));

    await client.query(`
      INSERT INTO article_details
      (date, platform, article_title, article_url, views, likes, comments)
      SELECT * FROM UNNEST(
        $1::text[], $2::text[], $3::text[], $4::text[],
        $5::integer[], $6::integer[], $7::integer[]
      )
      ON CONFLICT (platform, article_url)
        WHERE article_url IS NOT NULL AND article_url <> ''
      DO UPDATE SET
        date = EXCLUDED.date,
        article_title = EXCLUDED.article_title,
        views = COALESCE(EXCLUDED.views, article_details.views),
        likes = COALESCE(EXCLUDED.likes, article_details.likes),
        comments = COALESCE(EXCLUDED.comments, article_details.comments),
        updated_at = CURRENT_TIMESTAMP
    `, [
      articles.map(article => article.date),
      articles.map(() => platform),
      articles.map(article => article.article_title),
      articles.map(article => article.article_url),
      articles.map(article => article.views ?? null),
      articles.map(article => article.likes ?? null),
      articles.map(article => article.comments ?? null),
    ]);

    await client.query(`
      INSERT INTO article_stats
      (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)
      SELECT
        date, platform, COUNT(*)::integer,
        COALESCE(SUM(views), 0)::integer,
        ROUND(COALESCE(SUM(views), 0)::numeric / COUNT(*))::integer,
        COALESCE(SUM(likes), 0)::integer, 0,
        COALESCE(SUM(comments), 0)::integer, 0, COUNT(*)::integer
      FROM article_details
      WHERE platform = $1 AND date = ANY($2::text[])
      GROUP BY date, platform
      ON CONFLICT (date, platform) DO UPDATE SET
        article_count = EXCLUDED.article_count,
        total_views = EXCLUDED.total_views,
        avg_views = EXCLUDED.avg_views,
        likes = EXCLUDED.likes,
        bookmarks = article_stats.bookmarks,
        comments = EXCLUDED.comments,
        followers = article_stats.followers,
        new_articles = EXCLUDED.new_articles,
        updated_at = CURRENT_TIMESTAMP
    `, [platform, dates]);

    if (oldDates.length > 0) {
      // Only dates previously linked to these URLs may lose their derived summary.
      await client.query(`
        DELETE FROM article_stats AS s
        WHERE s.platform = $1 AND s.date = ANY($2::text[])
          AND COALESCE(s.followers, 0) = 0 AND COALESCE(s.bookmarks, 0) = 0
          AND NOT EXISTS (
            SELECT 1 FROM article_details AS d
            WHERE d.platform = s.platform AND d.date = s.date
          )
      `, [platform, oldDates]);

      await client.query(`
        UPDATE article_stats AS s
        SET article_count = 0, total_views = 0, avg_views = 0,
            likes = 0, comments = 0, new_articles = 0, updated_at = CURRENT_TIMESTAMP
        WHERE s.platform = $1 AND s.date = ANY($2::text[])
          AND NOT EXISTS (
            SELECT 1 FROM article_details AS d
            WHERE d.platform = s.platform AND d.date = s.date
          )
      `, [platform, oldDates]);
    }

    await client.query(`
      UPDATE reminder_settings
      SET last_data_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE platform = $1
    `, [platform]);
  });
}
