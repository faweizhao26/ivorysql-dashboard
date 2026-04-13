import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return;
  
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        watchers INTEGER DEFAULT 0,
        subscribers INTEGER DEFAULT 0,
        open_issues INTEGER DEFAULT 0,
        open_prs INTEGER DEFAULT 0,
        contributors INTEGER DEFAULT 0,
        releases_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contributor_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        total_contributors INTEGER DEFAULT 0,
        contributors_before_2026 INTEGER DEFAULT 0,
        new_contributors_daily INTEGER DEFAULT 0,
        new_contributors_weekly INTEGER DEFAULT 0,
        new_contributors_monthly INTEGER DEFAULT 0,
        new_contributors_quarterly INTEGER DEFAULT 0,
        cumulative_2026 INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        platform TEXT NOT NULL,
        followers INTEGER DEFAULT 0,
        posts INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        subscribers INTEGER DEFAULT 0,
        video_views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, platform)
      );

      CREATE TABLE IF NOT EXISTS article_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        platform TEXT NOT NULL,
        article_count INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0,
        avg_views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        bookmarks INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        followers INTEGER DEFAULT 0,
        new_articles INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, platform)
      );

      CREATE TABLE IF NOT EXISTS article_details (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        platform TEXT NOT NULL,
        article_title TEXT NOT NULL,
        article_url TEXT,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS website_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        pageviews INTEGER DEFAULT 0,
        unique_visitors INTEGER DEFAULT 0,
        top_pages TEXT DEFAULT '[]',
        sources TEXT DEFAULT '[]',
        keywords TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_events (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT,
        event_type TEXT DEFAULT 'github',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS manual_data (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reminder_settings (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL UNIQUE,
        update_frequency_days INTEGER DEFAULT 7,
        reminder_enabled INTEGER DEFAULT 1,
        webhook_url TEXT,
        last_reminder_sent TIMESTAMP,
        last_data_updated TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reminder_log (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        reminder_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'sent'
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id SERIAL PRIMARY KEY,
        event_name TEXT NOT NULL,
        event_date TEXT NOT NULL,
        event_type TEXT NOT NULL,
        location TEXT,
        venue TEXT,
        participants INTEGER DEFAULT 0,
        registrations INTEGER DEFAULT 0,
        online_viewers INTEGER DEFAULT 0,
        collected_data TEXT DEFAULT '{}',
        description TEXT,
        url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_social_date ON social_stats(date);
      CREATE INDEX IF NOT EXISTS idx_social_platform ON social_stats(platform);
      CREATE INDEX IF NOT EXISTS idx_article_date ON article_stats(date);
      CREATE INDEX IF NOT EXISTS idx_article_platform ON article_stats(platform);
      CREATE INDEX IF NOT EXISTS idx_events_date ON community_events(date);
      CREATE INDEX IF NOT EXISTS idx_manual_date ON manual_data(date);
      CREATE INDEX IF NOT EXISTS idx_article_details_date ON article_details(date);
      CREATE INDEX IF NOT EXISTS idx_article_details_platform ON article_details(platform);
      CREATE INDEX IF NOT EXISTS idx_activity_events_date ON activity_events(event_date);
    `);
    dbInitialized = true;
  } finally {
    client.release();
  }
}

initDb().catch(console.error);

export function getDb() {
  return pool;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export interface GitHubStats {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  subscribers: number;
  open_issues: number;
  open_prs: number;
  contributors: number;
  releases_count: number;
}

export interface ContributorStatsData {
  date: string;
  total_contributors: number;
  contributors_before_2026: number;
  new_contributors_daily: number;
  new_contributors_weekly: number;
  new_contributors_monthly: number;
  new_contributors_quarterly: number;
  cumulative_2026: number;
}

export interface SocialStats {
  date: string;
  platform: string;
  followers: number;
  posts: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  subscribers: number;
  video_views: number;
}

export interface ArticleStats {
  date: string;
  platform: string;
  article_count: number;
  total_views: number;
  avg_views: number;
  likes: number;
  bookmarks: number;
  comments: number;
  followers: number;
  new_articles: number;
}

export interface WebsiteStats {
  date: string;
  pageviews: number;
  unique_visitors: number;
  top_pages: string[];
  sources: string[];
  keywords: string[];
}

export interface CommunityEvent {
  date: string;
  source: string;
  title: string;
  description: string;
  url: string;
  event_type: string;
}

export interface ManualData {
  date: string;
  category: string;
  metric: string;
  value: number;
  notes?: string;
}

export interface ArticleDetails {
  id?: number;
  date: string;
  platform: string;
  article_title: string;
  article_url?: string;
  views: number;
  likes: number;
  comments: number;
}

export interface ReminderSettings {
  id?: number;
  platform: string;
  update_frequency_days: number;
  reminder_enabled: number;
  webhook_url?: string;
  last_reminder_sent?: string;
  last_data_updated?: string;
}

export async function saveGitHubStats(stats: GitHubStats): Promise<void> {
  await pool.query(`
    INSERT INTO github_stats 
    (date, stars, forks, watchers, subscribers, open_issues, open_prs, contributors, releases_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (date) DO UPDATE SET
      stars = EXCLUDED.stars,
      forks = EXCLUDED.forks,
      watchers = EXCLUDED.watchers,
      subscribers = EXCLUDED.subscribers,
      open_issues = EXCLUDED.open_issues,
      open_prs = EXCLUDED.open_prs,
      contributors = EXCLUDED.contributors,
      releases_count = EXCLUDED.releases_count
  `, [stats.date, stats.stars, stats.forks, stats.watchers, stats.subscribers,
      stats.open_issues, stats.open_prs, stats.contributors, stats.releases_count]);
}

export async function saveContributorStats(stats: ContributorStatsData): Promise<void> {
  await pool.query(`
    INSERT INTO contributor_stats 
    (date, total_contributors, contributors_before_2026, new_contributors_daily, 
     new_contributors_weekly, new_contributors_monthly, new_contributors_quarterly, cumulative_2026)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (date) DO UPDATE SET
      total_contributors = EXCLUDED.total_contributors,
      contributors_before_2026 = EXCLUDED.contributors_before_2026,
      new_contributors_daily = EXCLUDED.new_contributors_daily,
      new_contributors_weekly = EXCLUDED.new_contributors_weekly,
      new_contributors_monthly = EXCLUDED.new_contributors_monthly,
      new_contributors_quarterly = EXCLUDED.new_contributors_quarterly,
      cumulative_2026 = EXCLUDED.cumulative_2026
  `, [stats.date, stats.total_contributors, stats.contributors_before_2026,
      stats.new_contributors_daily, stats.new_contributors_weekly,
      stats.new_contributors_monthly, stats.new_contributors_quarterly, stats.cumulative_2026]);
}

export async function saveSocialStats(stats: SocialStats): Promise<void> {
  await pool.query(`
    INSERT INTO social_stats 
    (date, platform, followers, posts, views, likes, shares, comments, subscribers, video_views)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (date, platform) DO UPDATE SET
      followers = EXCLUDED.followers,
      posts = EXCLUDED.posts,
      views = EXCLUDED.views,
      likes = EXCLUDED.likes,
      shares = EXCLUDED.shares,
      comments = EXCLUDED.comments,
      subscribers = EXCLUDED.subscribers,
      video_views = EXCLUDED.video_views
  `, [stats.date, stats.platform, stats.followers, stats.posts, stats.views,
      stats.likes, stats.shares, stats.comments, stats.subscribers, stats.video_views]);
}

export async function saveArticleStats(stats: ArticleStats): Promise<void> {
  await pool.query(`
    INSERT INTO article_stats 
    (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (date, platform) DO UPDATE SET
      article_count = EXCLUDED.article_count,
      total_views = EXCLUDED.total_views,
      avg_views = EXCLUDED.avg_views,
      likes = EXCLUDED.likes,
      bookmarks = EXCLUDED.bookmarks,
      comments = EXCLUDED.comments,
      followers = EXCLUDED.followers,
      new_articles = EXCLUDED.new_articles
  `, [stats.date, stats.platform, stats.article_count, stats.total_views, stats.avg_views,
      stats.likes, stats.bookmarks, stats.comments, stats.followers, stats.new_articles]);
}

export async function saveWebsiteStats(stats: WebsiteStats): Promise<void> {
  await pool.query(`
    INSERT INTO website_stats 
    (date, pageviews, unique_visitors, top_pages, sources, keywords)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (date) DO UPDATE SET
      pageviews = EXCLUDED.pageviews,
      unique_visitors = EXCLUDED.unique_visitors,
      top_pages = EXCLUDED.top_pages,
      sources = EXCLUDED.sources,
      keywords = EXCLUDED.keywords
  `, [stats.date, stats.pageviews, stats.unique_visitors,
      JSON.stringify(stats.top_pages), JSON.stringify(stats.sources), JSON.stringify(stats.keywords)]);
}

export async function saveCommunityEvent(event: CommunityEvent): Promise<void> {
  await pool.query(`
    INSERT INTO community_events 
    (date, source, title, description, url, event_type)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [event.date, event.source, event.title, event.description, event.url, event.event_type]);
}

export async function saveManualData(data: ManualData): Promise<void> {
  await pool.query(`
    INSERT INTO manual_data (date, category, metric, value, notes)
    VALUES ($1, $2, $3, $4, $5)
  `, [data.date, data.category, data.metric, data.value, data.notes || null]);
}

export async function getLatestGitHubStats(): Promise<GitHubStats | null> {
  const result = await pool.query('SELECT * FROM github_stats ORDER BY date DESC LIMIT 1');
  return result.rows[0] || null;
}

export async function getGitHubStatsHistory(days: number = 30): Promise<GitHubStats[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM github_stats WHERE date >= $1 ORDER BY date ASC',
    [since.toISOString().split('T')[0]]
  );
  return result.rows;
}

export async function getLatestContributorStats(): Promise<ContributorStatsData | null> {
  const result = await pool.query('SELECT * FROM contributor_stats ORDER BY date DESC LIMIT 1');
  return result.rows[0] || null;
}

export async function getContributorStatsHistory(days: number = 365): Promise<ContributorStatsData[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM contributor_stats WHERE date >= $1 ORDER BY date ASC',
    [since.toISOString().split('T')[0]]
  );
  return result.rows;
}

export async function getSocialStatsByPlatform(platform: string, days: number = 30): Promise<SocialStats[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM social_stats WHERE platform = $1 AND date >= $2 ORDER BY date ASC',
    [platform, since.toISOString().split('T')[0]]
  );
  return result.rows;
}

export async function getLatestSocialStats(): Promise<SocialStats[]> {
  const result = await pool.query(`
    SELECT DISTINCT ON (platform) platform, s.*
    FROM social_stats s
    ORDER BY platform, date DESC
  `);
  return result.rows;
}

export async function getAllSocialPlatforms(): Promise<string[]> {
  const result = await pool.query('SELECT DISTINCT platform FROM social_stats');
  return result.rows.map(r => r.platform);
}

export async function getArticleStatsByPlatform(platform: string, days: number = 30): Promise<ArticleStats[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM article_stats WHERE platform = $1 AND date >= $2 ORDER BY date ASC',
    [platform, since.toISOString().split('T')[0]]
  );
  return result.rows;
}

export async function getLatestArticleStats(): Promise<ArticleStats[]> {
  const result = await pool.query(`
    SELECT DISTINCT ON (platform) platform, a.*
    FROM article_stats a
    ORDER BY platform, date DESC
  `);
  return result.rows;
}

export async function getAllArticlePlatforms(): Promise<string[]> {
  const result = await pool.query('SELECT DISTINCT platform FROM article_stats');
  return result.rows.map(r => r.platform);
}

export async function getWebsiteStatsHistory(days: number = 30): Promise<WebsiteStats[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM website_stats WHERE date >= $1 ORDER BY date ASC',
    [since.toISOString().split('T')[0]]
  );
  return result.rows.map(row => ({
    ...row,
    top_pages: JSON.parse(row.top_pages || '[]'),
    sources: JSON.parse(row.sources || '[]'),
    keywords: JSON.parse(row.keywords || '[]')
  }));
}

export async function getLatestWebsiteStats(): Promise<WebsiteStats | null> {
  const result = await pool.query('SELECT * FROM website_stats ORDER BY date DESC LIMIT 1');
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    top_pages: JSON.parse(row.top_pages || '[]'),
    sources: JSON.parse(row.sources || '[]'),
    keywords: JSON.parse(row.keywords || '[]')
  };
}

export async function getRecentEvents(days: number = 7, limit: number = 20): Promise<CommunityEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM community_events WHERE date >= $1 ORDER BY date DESC LIMIT $2',
    [since.toISOString().split('T')[0], limit]
  );
  return result.rows;
}

export async function getManualData(category?: string, days: number = 90): Promise<ManualData[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  if (category) {
    const result = await pool.query(
      'SELECT * FROM manual_data WHERE category = $1 AND date >= $2 ORDER BY date DESC',
      [category, since.toISOString().split('T')[0]]
    );
    return result.rows;
  }
  const result = await pool.query(
    'SELECT * FROM manual_data WHERE date >= $1 ORDER BY date DESC',
    [since.toISOString().split('T')[0]]
  );
  return result.rows;
}

export async function getGitHubStatsByDateRange(startDate: string, endDate: string): Promise<GitHubStats[]> {
  const result = await pool.query(
    'SELECT * FROM github_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getGitHubStatsForDate(date: string): Promise<GitHubStats | null> {
  const result = await pool.query('SELECT * FROM github_stats WHERE date = $1', [date]);
  return result.rows[0] || null;
}

export async function getContributorStatsByDateRange(startDate: string, endDate: string): Promise<ContributorStatsData[]> {
  const result = await pool.query(
    'SELECT * FROM contributor_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getContributorStatsForDate(date: string): Promise<ContributorStatsData | null> {
  const result = await pool.query('SELECT * FROM contributor_stats WHERE date = $1', [date]);
  return result.rows[0] || null;
}

export async function getSocialStatsByDateRange(startDate: string, endDate: string): Promise<SocialStats[]> {
  const result = await pool.query(
    'SELECT * FROM social_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getSocialStatsForDate(date: string): Promise<SocialStats[]> {
  const result = await pool.query('SELECT * FROM social_stats WHERE date = $1', [date]);
  return result.rows;
}

export async function getArticleStatsByDateRange(startDate: string, endDate: string, platform?: string): Promise<ArticleStats[]> {
  if (platform) {
    const result = await pool.query(
      'SELECT * FROM article_stats WHERE date >= $1 AND date <= $2 AND platform = $3 ORDER BY date ASC',
      [startDate, endDate, platform]
    );
    return result.rows;
  }
  const result = await pool.query(
    'SELECT * FROM article_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getArticleStatsForDate(date: string): Promise<ArticleStats[]> {
  const result = await pool.query('SELECT * FROM article_stats WHERE date = $1', [date]);
  return result.rows;
}

export async function getWebsiteStatsByDateRange(startDate: string, endDate: string): Promise<WebsiteStats[]> {
  const result = await pool.query(
    'SELECT * FROM website_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows.map(row => ({
    ...row,
    top_pages: JSON.parse(row.top_pages || '[]'),
    sources: JSON.parse(row.sources || '[]'),
    keywords: JSON.parse(row.keywords || '[]')
  }));
}

export async function getWebsiteStatsForDate(date: string): Promise<WebsiteStats | null> {
  const result = await pool.query('SELECT * FROM website_stats WHERE date = $1', [date]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    top_pages: JSON.parse(row.top_pages || '[]'),
    sources: JSON.parse(row.sources || '[]'),
    keywords: JSON.parse(row.keywords || '[]')
  };
}

export async function getEventsByDateRange(startDate: string, endDate: string, limit: number = 50): Promise<CommunityEvent[]> {
  const result = await pool.query(
    'SELECT * FROM community_events WHERE date >= $1 AND date <= $2 ORDER BY date DESC LIMIT $3',
    [startDate, endDate, limit]
  );
  return result.rows;
}

export async function getEventsForDate(date: string): Promise<CommunityEvent[]> {
  const result = await pool.query(
    'SELECT * FROM community_events WHERE date = $1 ORDER BY date DESC',
    [date]
  );
  return result.rows;
}

export async function saveArticleDetails(article: ArticleDetails): Promise<void> {
  await pool.query(`
    INSERT INTO article_details 
    (date, platform, article_title, article_url, views, likes, comments)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [article.date, article.platform, article.article_title, article.article_url || null, article.views, article.likes, article.comments]);
}

export async function getArticleDetailsByPlatform(platform: string, days: number = 30): Promise<ArticleDetails[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM article_details WHERE platform = $1 AND date >= $2 ORDER BY date DESC, views DESC',
    [platform, since.toISOString().split('T')[0]]
  );
  return result.rows;
}

export async function getArticleDetailsForDate(date: string): Promise<ArticleDetails[]> {
  const result = await pool.query(
    'SELECT * FROM article_details WHERE date = $1 ORDER BY views DESC',
    [date]
  );
  return result.rows;
}

export async function getLatestArticleDetails(platform: string): Promise<ArticleDetails[]> {
  const result = await pool.query(
    'SELECT * FROM article_details WHERE platform = $1 AND date = (SELECT MAX(date) FROM article_details WHERE platform = $1) ORDER BY views DESC',
    [platform]
  );
  return result.rows;
}

export async function deleteArticleDetails(id: number): Promise<void> {
  const article = await pool.query('SELECT platform, date FROM article_details WHERE id = $1', [id]);
  await pool.query('DELETE FROM article_details WHERE id = $1', [id]);
  if (article.rows[0]) {
    await recalculateArticleStatsForDate(article.rows[0].platform, article.rows[0].date);
  }
}

export async function getArticleDetailsById(id: number): Promise<ArticleDetails | null> {
  const result = await pool.query('SELECT * FROM article_details WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getAllArticleDetailsPlatforms(): Promise<string[]> {
  const result = await pool.query('SELECT DISTINCT platform FROM article_details');
  return result.rows.map(r => r.platform);
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await pool.query(`
    INSERT INTO reminder_settings 
    (platform, update_frequency_days, reminder_enabled, webhook_url, last_data_updated, updated_at)
    VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
    ON CONFLICT (platform) DO UPDATE SET
      update_frequency_days = EXCLUDED.update_frequency_days,
      reminder_enabled = EXCLUDED.reminder_enabled,
      webhook_url = EXCLUDED.webhook_url,
      last_data_updated = EXCLUDED.last_data_updated,
      updated_at = CURRENT_TIMESTAMP
  `, [settings.platform, settings.update_frequency_days, settings.reminder_enabled,
      settings.webhook_url || null, settings.last_data_updated || null]);
}

export async function getReminderSettings(platform?: string): Promise<ReminderSettings | ReminderSettings[] | null> {
  if (platform) {
    const result = await pool.query('SELECT * FROM reminder_settings WHERE platform = $1', [platform]);
    return result.rows[0] || null;
  }
  const result = await pool.query('SELECT * FROM reminder_settings');
  return result.rows;
}

export async function updateReminderLastSent(platform: string): Promise<void> {
  await pool.query(`
    UPDATE reminder_settings 
    SET last_reminder_sent = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE platform = $1
  `, [platform]);
}

export async function updateReminderLastUpdated(platform: string): Promise<void> {
  await pool.query(`
    UPDATE reminder_settings 
    SET last_data_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE platform = $1
  `, [platform]);
}

export async function getStalePlatforms(): Promise<{ platform: string; daysSinceUpdate: number; updateFrequency: number }[]> {
  const result = await pool.query('SELECT * FROM reminder_settings WHERE reminder_enabled = 1');
  const today = new Date();
  
  return result.rows.map(s => {
    const lastUpdated = s.last_data_updated ? new Date(s.last_data_updated) : new Date(0);
    const daysSinceUpdate = Math.floor((today.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    return {
      platform: s.platform,
      daysSinceUpdate,
      updateFrequency: s.update_frequency_days
    };
  }).filter(s => s.daysSinceUpdate >= s.updateFrequency);
}

export async function logReminderSent(platform: string, status: string): Promise<void> {
  await pool.query('INSERT INTO reminder_log (platform, status) VALUES ($1, $2)', [platform, status]);
}

export async function updateArticleDetails(id: number, article: Partial<ArticleDetails>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (article.date !== undefined) { fields.push('date = $' + (fields.length + 1)); values.push(article.date); }
  if (article.platform !== undefined) { fields.push('platform = $' + (fields.length + 1)); values.push(article.platform); }
  if (article.article_title !== undefined) { fields.push('article_title = $' + (fields.length + 1)); values.push(article.article_title); }
  if (article.article_url !== undefined) { fields.push('article_url = $' + (fields.length + 1)); values.push(article.article_url); }
  if (article.views !== undefined) { fields.push('views = $' + (fields.length + 1)); values.push(article.views); }
  if (article.likes !== undefined) { fields.push('likes = $' + (fields.length + 1)); values.push(article.likes); }
  if (article.comments !== undefined) { fields.push('comments = $' + (fields.length + 1)); values.push(article.comments); }
  
  if (fields.length === 0) return;
  
  values.push(id);
  await pool.query(`UPDATE article_details SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
}

export async function recalculateArticleStatsForDate(platform: string, date: string): Promise<void> {
  const articles = await pool.query(
    'SELECT * FROM article_details WHERE platform = $1 AND date = $2',
    [platform, date]
  );
  
  if (articles.rows.length === 0) {
    await pool.query('DELETE FROM article_stats WHERE platform = $1 AND date = $2', [platform, date]);
    return;
  }
  
  const total_views = articles.rows.reduce((sum, a) => sum + (a.views || 0), 0);
  const likes = articles.rows.reduce((sum, a) => sum + (a.likes || 0), 0);
  const comments = articles.rows.reduce((sum, a) => sum + (a.comments || 0), 0);
  const article_count = articles.rows.length;
  const avg_views = Math.round(total_views / article_count);
  
  await pool.query(`
    INSERT INTO article_stats 
    (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (date, platform) DO UPDATE SET
      article_count = EXCLUDED.article_count,
      total_views = EXCLUDED.total_views,
      avg_views = EXCLUDED.avg_views,
      likes = EXCLUDED.likes,
      bookmarks = EXCLUDED.bookmarks,
      comments = EXCLUDED.comments,
      new_articles = EXCLUDED.new_articles
  `, [date, platform, article_count, total_views, avg_views, likes, 0, comments, 0, article_count]);
}

export interface ActivityEvent {
  id?: number;
  event_name: string;
  event_date: string;
  event_type: string;
  location?: string;
  venue?: string;
  participants: number;
  registrations: number;
  online_viewers: number;
  collected_data: string;
  description?: string;
  url?: string;
}

export interface ActivityEventParsed extends Omit<ActivityEvent, 'collected_data'> {
  collected_data: Record<string, any>;
}

export async function saveActivityEvent(event: ActivityEvent): Promise<void> {
  await pool.query(`
    INSERT INTO activity_events 
    (event_name, event_date, event_type, location, venue, participants, registrations, online_viewers, collected_data, description, url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    event.event_name,
    event.event_date,
    event.event_type,
    event.location || null,
    event.venue || null,
    event.participants || 0,
    event.registrations || 0,
    event.online_viewers || 0,
    typeof event.collected_data === 'string' ? event.collected_data : JSON.stringify(event.collected_data || {}),
    event.description || null,
    event.url || null
  ]);
}

export async function updateActivityEvent(id: number, event: Partial<ActivityEvent>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (event.event_name !== undefined) { fields.push('event_name = $' + (fields.length + 1)); values.push(event.event_name); }
  if (event.event_date !== undefined) { fields.push('event_date = $' + (fields.length + 1)); values.push(event.event_date); }
  if (event.event_type !== undefined) { fields.push('event_type = $' + (fields.length + 1)); values.push(event.event_type); }
  if (event.location !== undefined) { fields.push('location = $' + (fields.length + 1)); values.push(event.location); }
  if (event.venue !== undefined) { fields.push('venue = $' + (fields.length + 1)); values.push(event.venue); }
  if (event.participants !== undefined) { fields.push('participants = $' + (fields.length + 1)); values.push(event.participants); }
  if (event.registrations !== undefined) { fields.push('registrations = $' + (fields.length + 1)); values.push(event.registrations); }
  if (event.online_viewers !== undefined) { fields.push('online_viewers = $' + (fields.length + 1)); values.push(event.online_viewers); }
  if (event.collected_data !== undefined) { fields.push('collected_data = $' + (fields.length + 1)); values.push(typeof event.collected_data === 'string' ? event.collected_data : JSON.stringify(event.collected_data)); }
  if (event.description !== undefined) { fields.push('description = $' + (fields.length + 1)); values.push(event.description); }
  if (event.url !== undefined) { fields.push('url = $' + (fields.length + 1)); values.push(event.url); }
  
  if (fields.length === 0) return;
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  await pool.query(`UPDATE activity_events SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
}

export async function deleteActivityEvent(id: number): Promise<void> {
  await pool.query('DELETE FROM activity_events WHERE id = $1', [id]);
}

export async function getActivityEvents(days: number = 365): Promise<ActivityEventParsed[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const result = await pool.query(
    'SELECT * FROM activity_events WHERE event_date >= $1 ORDER BY event_date DESC',
    [since.toISOString().split('T')[0]]
  );
  return result.rows.map(row => ({
    ...row,
    collected_data: JSON.parse(row.collected_data || '{}')
  }));
}

export async function getAllActivityEvents(): Promise<ActivityEventParsed[]> {
  const result = await pool.query('SELECT * FROM activity_events ORDER BY event_date DESC');
  return result.rows.map(row => ({
    ...row,
    collected_data: JSON.parse(row.collected_data || '{}')
  }));
}

export async function getActivityEventById(id: number): Promise<ActivityEventParsed | null> {
  const result = await pool.query('SELECT * FROM activity_events WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    collected_data: JSON.parse(row.collected_data || '{}')
  };
}