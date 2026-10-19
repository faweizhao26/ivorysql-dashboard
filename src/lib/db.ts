import { Pool, type PoolClient } from 'pg';
import { getBeijingDate, shiftDate } from './date';
import type { MainRepoContributor, MainRepoMonthlyActivity } from './contributor-activity';

let pool: Pool | null = null;

let dbInitialization: Promise<void> | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || '',
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true
    });
  }
  return pool;
}

async function query(text: string, values?: unknown[]) {
  await initDb();
  return getPool().query(text, values);
}

async function initDb() {
  if (!dbInitialization) {
    dbInitialization = initializeDb().catch((error) => {
      dbInitialization = null;
      throw error;
    });
  }
  return dbInitialization;
}

async function initializeDb() {
  const client = await getPool().connect();
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
        main_repo_issue_creators INTEGER,
        main_repo_pr_creators INTEGER,
        main_repo_unique_creators INTEGER,
        main_repo_issue_count INTEGER,
        main_repo_pr_count INTEGER,
        main_repo_merged_pr_count INTEGER,
        main_repo_unmerged_pr_count INTEGER,
        main_repo_merged_pr_creators INTEGER,
        main_repo_unmerged_pr_creators INTEGER,
        main_repo_top_contributors JSONB,
        main_repo_activity_since TEXT,
        main_repo_code_contributors INTEGER,
        main_repo_monthly_activity JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_issue_creators INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_pr_creators INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_unique_creators INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_issue_count INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_pr_count INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_merged_pr_count INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_unmerged_pr_count INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_merged_pr_creators INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_unmerged_pr_creators INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_top_contributors JSONB;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_activity_since TEXT;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_code_contributors INTEGER;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS main_repo_monthly_activity JSONB;

      ALTER TABLE github_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE contributor_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

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
        content_category TEXT,
        content_source TEXT,
        published_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE article_details DROP CONSTRAINT IF EXISTS unique_article;
      ALTER TABLE article_details DROP CONSTRAINT IF EXISTS article_details_date_platform_article_title_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_article_details_platform_url_unique
        ON article_details(platform, article_url)
        WHERE article_url IS NOT NULL AND article_url <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_article_details_fallback_unique
        ON article_details(date, platform, article_title)
        WHERE article_url IS NULL OR article_url = '';

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

      ALTER TABLE social_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE article_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE article_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE website_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

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

      CREATE TABLE IF NOT EXISTS activity_materials (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
        material_type TEXT NOT NULL CHECK (material_type IN ('photo', 'poster', 'ppt', 'video', 'article', 'other')),
        title TEXT NOT NULL,
        url TEXT,
        thumbnail_url TEXT,
        access_note TEXT,
        source_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS source_url TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_events_source_url
        ON activity_events(source_url) WHERE source_url IS NOT NULL;
      ALTER TABLE activity_materials ENABLE ROW LEVEL SECURITY;

      CREATE TABLE IF NOT EXISTS sync_runs (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP,
        status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
        records_seen INTEGER NOT NULL DEFAULT 0,
        records_written INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        trigger TEXT NOT NULL CHECK (trigger IN ('vercel_cron', 'ego_lite', 'manual'))
      );

      CREATE TABLE IF NOT EXISTS quarantined_sample_data (
        id SERIAL PRIMARY KEY,
        source_table TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        row_data JSONB NOT NULL,
        quarantined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_table, source_id)
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
      CREATE INDEX IF NOT EXISTS idx_activity_materials_event_order ON activity_materials(event_id, sort_order, id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_materials_event_url_unique
        ON activity_materials(event_id, url)
        WHERE url IS NOT NULL AND url <> '';
      CREATE INDEX IF NOT EXISTS idx_sync_runs_platform_started ON sync_runs(platform, started_at DESC);

      CREATE TABLE IF NOT EXISTS download_stats (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        github_total INTEGER DEFAULT 0,
        docker_total INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE download_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS evangelist_participants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_url TEXT,
        title TEXT,
        bio TEXT,
        joined_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS evangelist_contributions (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER NOT NULL REFERENCES evangelist_participants(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        url TEXT,
        points INTEGER DEFAULT 0,
        date TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_evangelist_contrib_pid ON evangelist_contributions(participant_id);
    `);
  } finally {
    client.release();
  }
}

export function getDb() {
  return getPool();
}

export async function queryDb(text: string, values?: unknown[]) {
  return query(text, values);
}

export async function withDbTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  await initDb();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function getToday(): string {
  return getBeijingDate();
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
  main_repo_issue_creators?: number;
  main_repo_pr_creators?: number;
  main_repo_unique_creators?: number;
  main_repo_issue_count?: number;
  main_repo_pr_count?: number;
  main_repo_merged_pr_count?: number;
  main_repo_unmerged_pr_count?: number;
  main_repo_merged_pr_creators?: number;
  main_repo_unmerged_pr_creators?: number;
  main_repo_top_contributors?: MainRepoContributor[];
  main_repo_activity_since?: string;
  main_repo_code_contributors?: number;
  main_repo_monthly_activity?: MainRepoMonthlyActivity[];
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
  content_category?: string;
  content_source?: string;
  published_date?: string;
}

export interface ArticlePlatformSummary {
  platform: string;
  article_count: number;
  total_views: number;
  data_date: string | null;
  updated_at: string | null;
}

export interface PagedArticleDetails {
  items: ArticleDetails[];
  total: number;
}

export interface SyncedArticleDetails {
  date: string;
  platform: string;
  article_title: string;
  article_url: string;
  views?: number;
  likes?: number;
  comments?: number;
}

export interface DownloadStatsHistory {
  date: string;
  github_total: number;
  docker_total: number;
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
  await query(`
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
      releases_count = EXCLUDED.releases_count,
      updated_at = CURRENT_TIMESTAMP
  `, [stats.date, stats.stars, stats.forks, stats.watchers, stats.subscribers,
      stats.open_issues, stats.open_prs, stats.contributors, stats.releases_count]);
}

export async function saveContributorStats(stats: ContributorStatsData): Promise<void> {
  await query(`
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
      cumulative_2026 = EXCLUDED.cumulative_2026,
      updated_at = CURRENT_TIMESTAMP
  `, [stats.date, stats.total_contributors, stats.contributors_before_2026,
      stats.new_contributors_daily, stats.new_contributors_weekly,
      stats.new_contributors_monthly, stats.new_contributors_quarterly, stats.cumulative_2026]);
}

export async function saveMainRepoContributorStats(
  date: string,
  stats: {
    issue_creators: number;
    pr_creators: number;
    unique_creators: number;
    issue_count: number;
    pr_count: number;
    merged_pr_count: number;
    unmerged_pr_count: number;
    merged_pr_creators: number;
    unmerged_pr_creators: number;
    top_contributors: MainRepoContributor[];
    code_contributors?: number;
    monthly_activity?: MainRepoMonthlyActivity[];
  },
  since: string,
): Promise<void> {
  await query(`
    INSERT INTO contributor_stats
    (date, main_repo_issue_creators, main_repo_pr_creators, main_repo_unique_creators,
     main_repo_issue_count, main_repo_pr_count, main_repo_merged_pr_count, main_repo_unmerged_pr_count,
     main_repo_merged_pr_creators, main_repo_unmerged_pr_creators, main_repo_top_contributors, main_repo_activity_since,
     main_repo_code_contributors, main_repo_monthly_activity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14::jsonb)
    ON CONFLICT (date) DO UPDATE SET
      main_repo_issue_creators = EXCLUDED.main_repo_issue_creators,
      main_repo_pr_creators = EXCLUDED.main_repo_pr_creators,
      main_repo_unique_creators = EXCLUDED.main_repo_unique_creators,
      main_repo_issue_count = EXCLUDED.main_repo_issue_count,
      main_repo_pr_count = EXCLUDED.main_repo_pr_count,
      main_repo_merged_pr_count = EXCLUDED.main_repo_merged_pr_count,
      main_repo_unmerged_pr_count = EXCLUDED.main_repo_unmerged_pr_count,
      main_repo_merged_pr_creators = EXCLUDED.main_repo_merged_pr_creators,
      main_repo_unmerged_pr_creators = EXCLUDED.main_repo_unmerged_pr_creators,
      main_repo_top_contributors = EXCLUDED.main_repo_top_contributors,
      main_repo_activity_since = EXCLUDED.main_repo_activity_since,
      main_repo_code_contributors = EXCLUDED.main_repo_code_contributors,
      main_repo_monthly_activity = EXCLUDED.main_repo_monthly_activity,
      updated_at = CURRENT_TIMESTAMP
  `, [date, stats.issue_creators, stats.pr_creators, stats.unique_creators,
      stats.issue_count, stats.pr_count, stats.merged_pr_count, stats.unmerged_pr_count,
      stats.merged_pr_creators, stats.unmerged_pr_creators,
      JSON.stringify(stats.top_contributors), since,
      stats.code_contributors ?? null,
      JSON.stringify(stats.monthly_activity ?? [])]);
}

export async function saveSocialStats(stats: SocialStats): Promise<void> {
  await query(`
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
      video_views = EXCLUDED.video_views,
      updated_at = CURRENT_TIMESTAMP
  `, [stats.date, stats.platform, stats.followers, stats.posts, stats.views,
      stats.likes, stats.shares, stats.comments, stats.subscribers, stats.video_views]);
}

export async function saveArticleStats(stats: ArticleStats): Promise<void> {
  await query(`
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
      new_articles = EXCLUDED.new_articles,
      updated_at = CURRENT_TIMESTAMP
  `, [stats.date, stats.platform, stats.article_count, stats.total_views, stats.avg_views,
      stats.likes, stats.bookmarks, stats.comments, stats.followers, stats.new_articles]);
}

export async function saveCommunityEvent(event: CommunityEvent): Promise<void> {
  await query(`
    INSERT INTO community_events 
    (date, source, title, description, url, event_type)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [event.date, event.source, event.title, event.description, event.url, event.event_type]);
}

export async function saveManualData(data: ManualData): Promise<void> {
  await query(`
    INSERT INTO manual_data (date, category, metric, value, notes)
    VALUES ($1, $2, $3, $4, $5)
  `, [data.date, data.category, data.metric, data.value, data.notes || null]);
}

export async function getLatestGitHubStats(endDate?: string): Promise<GitHubStats | null> {
  const result = endDate
    ? await query('SELECT * FROM github_stats WHERE date <= $1 ORDER BY date DESC LIMIT 1', [endDate])
    : await query('SELECT * FROM github_stats ORDER BY date DESC LIMIT 1');
  return result.rows[0] || null;
}

export async function getGitHubStatsHistory(days: number = 30): Promise<GitHubStats[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM github_stats WHERE date >= $1 ORDER BY date ASC',
    [since]
  );
  return result.rows;
}

const contributorSummaryColumns = 'date, total_contributors, contributors_before_2026, new_contributors_daily, new_contributors_weekly, new_contributors_monthly, new_contributors_quarterly, cumulative_2026, main_repo_code_contributors, updated_at';

export async function getLatestContributorStats(endDate?: string, includeDetails: boolean = true): Promise<ContributorStatsData | null> {
  const columns = includeDetails ? '*' : contributorSummaryColumns;
  const result = endDate
    ? await query(`SELECT ${columns} FROM contributor_stats WHERE date <= $1 ORDER BY date DESC LIMIT 1`, [endDate])
    : await query(`SELECT ${columns} FROM contributor_stats ORDER BY date DESC LIMIT 1`);
  return result.rows[0] || null;
}

export async function getContributorStatsHistory(days: number = 365): Promise<ContributorStatsData[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    `SELECT ${contributorSummaryColumns} FROM contributor_stats WHERE date >= $1 ORDER BY date ASC`,
    [since]
  );
  return result.rows;
}

export async function getSocialStatsByPlatform(platform: string, days: number = 30): Promise<SocialStats[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM social_stats WHERE platform = $1 AND date >= $2 ORDER BY date ASC',
    [platform, since]
  );
  return result.rows;
}

export async function getLatestSocialStats(endDate?: string): Promise<SocialStats[]> {
  const result = await query(`
    SELECT DISTINCT ON (platform) platform, s.*
    FROM social_stats s
    ${endDate ? 'WHERE date <= $1' : ''}
    ORDER BY platform, date DESC
  `, endDate ? [endDate] : undefined);
  return result.rows;
}

export async function getAllSocialPlatforms(): Promise<string[]> {
  const result = await query('SELECT DISTINCT platform FROM social_stats');
  return result.rows.map(r => r.platform);
}

export async function getArticleStatsByPlatform(platform: string, days: number = 30): Promise<ArticleStats[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM article_stats WHERE platform = $1 AND date >= $2 ORDER BY date ASC',
    [platform, since]
  );
  return result.rows;
}

export async function getLatestArticleStats(endDate?: string): Promise<ArticleStats[]> {
  const result = await query(`
    SELECT DISTINCT ON (platform) platform, a.*
    FROM article_stats a
    ${endDate ? 'WHERE date <= $1' : ''}
    ORDER BY platform, date DESC
  `, endDate ? [endDate] : undefined);
  return result.rows;
}

export async function getAllArticlePlatforms(): Promise<string[]> {
  const result = await query('SELECT DISTINCT platform FROM article_stats');
  return result.rows.map(r => r.platform);
}

export async function getRecentEvents(days: number = 7, limit: number = 20): Promise<CommunityEvent[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM community_events WHERE date >= $1 ORDER BY date DESC LIMIT $2',
    [since, limit]
  );
  return result.rows;
}

export async function getManualData(category?: string, days: number = 90): Promise<ManualData[]> {
  const since = shiftDate(getToday(), -days);
  if (category) {
    const result = await query(
      'SELECT * FROM manual_data WHERE category = $1 AND date >= $2 ORDER BY date DESC',
      [category, since]
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM manual_data WHERE date >= $1 ORDER BY date DESC',
    [since]
  );
  return result.rows;
}

export async function getGitHubStatsByDateRange(startDate: string, endDate: string): Promise<GitHubStats[]> {
  const result = await query(
    'SELECT * FROM github_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getGitHubStatsForDate(date: string): Promise<GitHubStats | null> {
  const result = await query('SELECT * FROM github_stats WHERE date = $1', [date]);
  return result.rows[0] || null;
}

export async function getContributorStatsByDateRange(startDate: string, endDate: string): Promise<ContributorStatsData[]> {
  const result = await query(
    `SELECT ${contributorSummaryColumns} FROM contributor_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC`,
    [startDate, endDate]
  );
  return result.rows;
}

export async function getContributorStatsForDate(date: string, includeDetails: boolean = true): Promise<ContributorStatsData | null> {
  const columns = includeDetails ? '*' : contributorSummaryColumns;
  const result = await query(`SELECT ${columns} FROM contributor_stats WHERE date = $1`, [date]);
  return result.rows[0] || null;
}

export async function getSocialStatsByDateRange(startDate: string, endDate: string, platform?: string): Promise<SocialStats[]> {
  if (platform) {
    const result = await query(
      'SELECT * FROM social_stats WHERE date >= $1 AND date <= $2 AND platform = $3 ORDER BY date ASC',
      [startDate, endDate, platform]
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM social_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getSocialStatsForDate(date: string): Promise<SocialStats[]> {
  const result = await query('SELECT * FROM social_stats WHERE date = $1', [date]);
  return result.rows;
}

export async function getArticleStatsByDateRange(startDate: string, endDate: string, platform?: string): Promise<ArticleStats[]> {
  if (platform) {
    const result = await query(
      'SELECT * FROM article_stats WHERE date >= $1 AND date <= $2 AND platform = $3 ORDER BY date ASC',
      [startDate, endDate, platform]
    );
    return result.rows;
  }
  const result = await query(
    'SELECT * FROM article_stats WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

export async function getArticleStatsForDate(date: string): Promise<ArticleStats[]> {
  const result = await query('SELECT * FROM article_stats WHERE date = $1', [date]);
  return result.rows;
}

export async function getEventsByDateRange(startDate: string, endDate: string, limit: number = 50): Promise<CommunityEvent[]> {
  const result = await query(
    'SELECT * FROM community_events WHERE date >= $1 AND date <= $2 ORDER BY date DESC LIMIT $3',
    [startDate, endDate, limit]
  );
  return result.rows;
}

export async function getEventsForDate(date: string): Promise<CommunityEvent[]> {
  const result = await query(
    'SELECT * FROM community_events WHERE date = $1 ORDER BY date DESC',
    [date]
  );
  return result.rows;
}

export async function saveArticleDetails(article: ArticleDetails, execute = query): Promise<void> {
  const conflictTarget = article.article_url
    ? `(platform, article_url) WHERE article_url IS NOT NULL AND article_url <> ''`
    : `(date, platform, article_title) WHERE article_url IS NULL OR article_url = ''`;

  await execute(`
    INSERT INTO article_details 
    (date, platform, article_title, article_url, views, likes, comments, content_category, content_source, published_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT ${conflictTarget} DO UPDATE SET
      date = EXCLUDED.date,
      article_title = EXCLUDED.article_title,
      article_url = EXCLUDED.article_url,
      views = EXCLUDED.views,
      likes = EXCLUDED.likes,
      comments = EXCLUDED.comments,
      content_category = COALESCE(EXCLUDED.content_category, article_details.content_category),
      content_source = COALESCE(EXCLUDED.content_source, article_details.content_source),
      updated_at = CURRENT_TIMESTAMP
  `, [article.date, article.platform, article.article_title, article.article_url || null,
    article.views, article.likes, article.comments,
    article.content_category || null, article.content_source || null, article.published_date || null]);
}

export async function saveSyncedArticleDetails(article: SyncedArticleDetails): Promise<void> {
  await query(`
    INSERT INTO article_details
    (date, platform, article_title, article_url, views, likes, comments)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
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
    article.date,
    article.platform,
    article.article_title,
    article.article_url,
    article.views ?? null,
    article.likes ?? null,
    article.comments ?? null,
  ]);
}

export async function saveSyncedArticleDetailsBatch(articles: SyncedArticleDetails[]): Promise<void> {
  if (articles.length === 0) return;

  await query(`
    INSERT INTO article_details
    (date, platform, article_title, article_url, views, likes, comments)
    SELECT * FROM UNNEST(
      $1::text[],
      $2::text[],
      $3::text[],
      $4::text[],
      $5::integer[],
      $6::integer[],
      $7::integer[]
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
    articles.map(article => article.platform),
    articles.map(article => article.article_title),
    articles.map(article => article.article_url),
    articles.map(article => article.views ?? null),
    articles.map(article => article.likes ?? null),
    articles.map(article => article.comments ?? null),
  ]);
}

export async function deleteArticleDetailsByDate(platform: string, date: string): Promise<void> {
  await query('DELETE FROM article_details WHERE platform = $1 AND date = $2', [platform, date]);
}

export async function saveDownloadStats(date: string, githubTotal: number, dockerTotal: number): Promise<void> {
  await query(
    'INSERT INTO download_stats (date, github_total, docker_total) VALUES ($1, $2, $3) ON CONFLICT (date) DO UPDATE SET github_total = $2, docker_total = $3, updated_at = CURRENT_TIMESTAMP',
    [date, githubTotal, dockerTotal]
  );
}

export async function getDownloadStatsHistory(days: number = 90): Promise<DownloadStatsHistory[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM download_stats WHERE date >= $1 ORDER BY date ASC',
    [since]
  );
  return result.rows;
}

export async function getArticleDetailsByPlatform(platform: string, days: number = 30): Promise<ArticleDetails[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM article_details WHERE platform = $1 AND date >= $2 ORDER BY date DESC, views DESC',
    [platform, since]
  );
  return result.rows;
}

export async function getRecentArticleDetailsByPlatform(
  platform: string,
  limit: number = 50,
): Promise<ArticleDetails[]> {
  const result = await query(
    `SELECT * FROM article_details
     WHERE platform = $1 AND article_url IS NOT NULL AND article_url <> ''
     ORDER BY COALESCE(published_date, date) DESC, id DESC
     LIMIT $2`,
    [platform, limit],
  );
  return result.rows;
}

export async function getArticleDetailsForDate(date: string): Promise<ArticleDetails[]> {
  const result = await query(
    'SELECT * FROM article_details WHERE date = $1 ORDER BY views DESC',
    [date]
  );
  return result.rows;
}

export async function getLatestArticleDetails(platform: string): Promise<ArticleDetails[]> {
  const result = await query(
    'SELECT * FROM article_details WHERE platform = $1 AND date = (SELECT MAX(date) FROM article_details WHERE platform = $1) ORDER BY views DESC',
    [platform]
  );
  return result.rows;
}

export async function deleteArticleDetails(id: number): Promise<void> {
  const article = await query('SELECT platform, date FROM article_details WHERE id = $1', [id]);
  await query('DELETE FROM article_details WHERE id = $1', [id]);
  if (article.rows[0]) {
    await recalculateArticleStatsForDate(article.rows[0].platform, article.rows[0].date);
  }
}

export async function getArticleDetailsById(id: number): Promise<ArticleDetails | null> {
  const result = await query('SELECT * FROM article_details WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getAllArticleDetailsPlatforms(): Promise<string[]> {
  const result = await query('SELECT DISTINCT platform FROM article_details');
  return result.rows.map(r => r.platform);
}

export async function getArticlePlatformSummaries(): Promise<ArticlePlatformSummary[]> {
  const result = await query(`
    SELECT platform,
           COUNT(*)::integer AS article_count,
           COALESCE(SUM(views), 0)::bigint AS total_views,
           MAX(COALESCE(published_date, date)) AS data_date,
           MAX(updated_at) AS updated_at
    FROM article_details
    GROUP BY platform
    ORDER BY platform
  `);
  return result.rows.map(row => ({
    ...row,
    total_views: Number(row.total_views || 0),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }));
}

export async function getPagedArticleDetails(options: {
  platform: string;
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}): Promise<PagedArticleDetails> {
  const conditions = ['platform = $1'];
  const values: unknown[] = [options.platform];
  if (options.search) {
    values.push(`%${options.search}%`);
    conditions.push(`article_title ILIKE $${values.length}`);
  }
  if (options.category) {
    values.push(options.category);
    conditions.push(`content_category = $${values.length}`);
  }
  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*)::integer AS total FROM article_details WHERE ${where}`, values);
  values.push(options.pageSize, (options.page - 1) * options.pageSize);
  const rows = await query(
    `SELECT * FROM article_details WHERE ${where}
     ORDER BY COALESCE(published_date, date) DESC, id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: rows.rows, total: Number(countResult.rows[0]?.total || 0) };
}

export async function getAllArticleDetailsForExport(platform?: string): Promise<ArticleDetails[]> {
  const result = platform
    ? await query(`SELECT * FROM article_details WHERE platform = $1 ORDER BY COALESCE(published_date, date) DESC, id DESC`, [platform])
    : await query(`SELECT * FROM article_details ORDER BY platform, COALESCE(published_date, date) DESC, id DESC`);
  return result.rows;
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await query(`
    INSERT INTO reminder_settings 
    (platform, update_frequency_days, reminder_enabled, webhook_url, last_data_updated, updated_at)
    VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
    ON CONFLICT (platform) DO UPDATE SET
      update_frequency_days = EXCLUDED.update_frequency_days,
      reminder_enabled = EXCLUDED.reminder_enabled,
      webhook_url = EXCLUDED.webhook_url,
      last_data_updated = COALESCE(EXCLUDED.last_data_updated, reminder_settings.last_data_updated),
      updated_at = CURRENT_TIMESTAMP
  `, [settings.platform, settings.update_frequency_days, settings.reminder_enabled,
      settings.webhook_url || null, settings.last_data_updated || null]);
}

export async function getReminderSettings(platform?: string): Promise<ReminderSettings | ReminderSettings[] | null> {
  if (platform) {
    const result = await query('SELECT * FROM reminder_settings WHERE platform = $1', [platform]);
    return result.rows[0] || null;
  }
  const result = await query('SELECT * FROM reminder_settings');
  return result.rows;
}

export async function updateReminderLastSent(platform: string): Promise<void> {
  await query(`
    UPDATE reminder_settings 
    SET last_reminder_sent = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE platform = $1
  `, [platform]);
}

export async function updateReminderLastUpdated(platform: string): Promise<void> {
  await query(`
    UPDATE reminder_settings 
    SET last_data_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE platform = $1
  `, [platform]);
}

export async function getStalePlatforms(): Promise<{ platform: string; daysSinceUpdate: number; updateFrequency: number }[]> {
  const result = await query(`
    SELECT r.*,
      CASE WHEN s.run_count > 0 THEN s.last_success_at ELSE r.last_data_updated END AS effective_updated_at
    FROM reminder_settings r
    LEFT JOIN (
      SELECT platform, COUNT(*) AS run_count,
        MAX(finished_at) FILTER (WHERE status = 'success') AS last_success_at
      FROM sync_runs GROUP BY platform
    ) s ON s.platform = r.platform
    WHERE r.reminder_enabled = 1 AND r.platform <> 'juejin'
  `);
  const today = new Date();
  
  return result.rows.map(s => {
    const lastUpdated = s.effective_updated_at ? new Date(s.effective_updated_at) : new Date(0);
    const daysSinceUpdate = Math.floor((today.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    return {
      platform: s.platform,
      daysSinceUpdate,
      updateFrequency: s.update_frequency_days
    };
  }).filter(s => s.daysSinceUpdate >= s.updateFrequency);
}

export async function logReminderSent(platform: string, status: string): Promise<void> {
  await query('INSERT INTO reminder_log (platform, status) VALUES ($1, $2)', [platform, status]);
}

export async function updateArticleDetails(id: number, article: Partial<ArticleDetails>, execute = query): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  
  if (article.date !== undefined) { fields.push('date = $' + (fields.length + 1)); values.push(article.date); }
  if (article.platform !== undefined) { fields.push('platform = $' + (fields.length + 1)); values.push(article.platform); }
  if (article.article_title !== undefined) { fields.push('article_title = $' + (fields.length + 1)); values.push(article.article_title); }
  if (article.article_url !== undefined) { fields.push('article_url = $' + (fields.length + 1)); values.push(article.article_url); }
  if (article.views !== undefined) { fields.push('views = $' + (fields.length + 1)); values.push(article.views); }
  if (article.likes !== undefined) { fields.push('likes = $' + (fields.length + 1)); values.push(article.likes); }
  if (article.comments !== undefined) { fields.push('comments = $' + (fields.length + 1)); values.push(article.comments); }
  if (article.content_category !== undefined) { fields.push('content_category = $' + (fields.length + 1)); values.push(article.content_category); }
  if (article.content_source !== undefined) { fields.push('content_source = $' + (fields.length + 1)); values.push(article.content_source); }
  if (article.published_date !== undefined) { fields.push('published_date = $' + (fields.length + 1)); values.push(article.published_date || null); }
  
  if (fields.length === 0) return;
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  await execute(`UPDATE article_details SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
}

export async function recalculateArticleStatsForDate(platform: string, date: string, execute = query): Promise<void> {
  const articles = await execute(
    'SELECT * FROM article_details WHERE platform = $1 AND date = $2',
    [platform, date]
  );
  
  if (articles.rows.length === 0) {
    await execute(`DELETE FROM article_stats WHERE platform = $1 AND date = $2
      AND COALESCE(followers, 0) = 0 AND COALESCE(bookmarks, 0) = 0`, [platform, date]);
    await execute(`UPDATE article_stats
      SET article_count = 0, total_views = 0, avg_views = 0, likes = 0, comments = 0,
          new_articles = 0, updated_at = CURRENT_TIMESTAMP
      WHERE platform = $1 AND date = $2`, [platform, date]);
    return;
  }
  
  const total_views = articles.rows.reduce((sum, a) => sum + (a.views || 0), 0);
  const likes = articles.rows.reduce((sum, a) => sum + (a.likes || 0), 0);
  const comments = articles.rows.reduce((sum, a) => sum + (a.comments || 0), 0);
  const article_count = articles.rows.length;
  const avg_views = Math.round(total_views / article_count);
  
  await execute(`
    INSERT INTO article_stats 
    (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
  `, [date, platform, article_count, total_views, avg_views, likes, 0, comments, 0, article_count]);
}

export async function recalculateArticleStatsForDates(platform: string, dates: string[]): Promise<void> {
  if (dates.length === 0) return;

  await query(`
    INSERT INTO article_stats
    (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)
    SELECT
      date,
      platform,
      COUNT(*)::integer,
      COALESCE(SUM(views), 0)::integer,
      ROUND(COALESCE(SUM(views), 0)::numeric / COUNT(*))::integer,
      COALESCE(SUM(likes), 0)::integer,
      0,
      COALESCE(SUM(comments), 0)::integer,
      0,
      COUNT(*)::integer
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
  collected_data: string | Record<string, unknown>;
  description?: string;
  url?: string;
  source_url?: string;
}

export interface ActivityEventParsed extends Omit<ActivityEvent, 'collected_data'> {
  collected_data: Record<string, unknown>;
}

export interface ActivityEventListOptions {
  page: number;
  pageSize: number;
  year?: string;
  type?: string;
  search?: string;
}

export interface ActivityEventListItem extends ActivityEventParsed {
  material_counts: Record<string, number>;
  material_total: number;
}

export interface ActivityEventTotals {
  events: number;
  participants: number;
  registrations: number;
  online_viewers: number;
}

function parseCollectedData(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  try {
    return JSON.parse(typeof value === 'string' ? value : '{}');
  } catch {
    return {};
  }
}

function buildActivityEventFilters(options: ActivityEventListOptions) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (options.year) {
    values.push(options.year);
    clauses.push(`LEFT(e.event_date, 4) = $${values.length}`);
  }
  if (options.type) {
    values.push(options.type);
    clauses.push(`e.event_type = $${values.length}`);
  }
  if (options.search) {
    values.push(`%${options.search}%`);
    clauses.push(`(e.event_name ILIKE $${values.length} OR e.location ILIKE $${values.length} OR e.venue ILIKE $${values.length} OR e.description ILIKE $${values.length})`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

export async function getPagedActivityEvents(options: ActivityEventListOptions): Promise<{
  items: ActivityEventListItem[];
  total: number;
  facets: { years: string[]; types: string[] };
  totals: ActivityEventTotals;
}> {
  const { where, values } = buildActivityEventFilters(options);
  const pageValues = [...values, options.pageSize, (options.page - 1) * options.pageSize];
  const [itemsResult, totalsResult, yearsResult, typesResult] = await Promise.all([
    query(`
      SELECT e.*,
        COALESCE(m.material_counts, '{}'::jsonb) AS material_counts,
        COALESCE(m.material_total, 0)::integer AS material_total
      FROM activity_events e
      LEFT JOIN (
        SELECT event_id,
          jsonb_object_agg(material_type, type_count) AS material_counts,
          SUM(type_count)::integer AS material_total
        FROM (
          SELECT event_id, material_type, COUNT(*)::integer AS type_count
          FROM activity_materials
          GROUP BY event_id, material_type
        ) grouped_materials
        GROUP BY event_id
      ) m ON m.event_id = e.id
      ${where}
      ORDER BY e.event_date DESC, e.id DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, pageValues),
    query(`
      SELECT COUNT(*)::integer AS events,
        COALESCE(SUM(e.participants), 0)::integer AS participants,
        COALESCE(SUM(e.registrations), 0)::integer AS registrations,
        COALESCE(SUM(e.online_viewers), 0)::integer AS online_viewers
      FROM activity_events e ${where}
    `, values),
    query(`SELECT DISTINCT LEFT(event_date, 4) AS value FROM activity_events WHERE event_date <> '' ORDER BY value DESC`),
    query(`SELECT DISTINCT event_type AS value FROM activity_events WHERE event_type <> '' ORDER BY value ASC`),
  ]);

  const totals = totalsResult.rows[0] || { events: 0, participants: 0, registrations: 0, online_viewers: 0 };
  return {
    items: itemsResult.rows.map(row => ({
      ...row,
      collected_data: parseCollectedData(row.collected_data),
      material_counts: row.material_counts || {},
      material_total: Number(row.material_total || 0),
    })),
    total: Number(totals.events || 0),
    facets: {
      years: yearsResult.rows.map(row => String(row.value)),
      types: typesResult.rows.map(row => String(row.value)),
    },
    totals: {
      events: Number(totals.events || 0),
      participants: Number(totals.participants || 0),
      registrations: Number(totals.registrations || 0),
      online_viewers: Number(totals.online_viewers || 0),
    },
  };
}

export async function saveActivityEvent(event: ActivityEvent): Promise<number> {
  const result = await query(`
    INSERT INTO activity_events 
    (event_name, event_date, event_type, location, venue, participants, registrations, online_viewers, collected_data, description, url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
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
  return Number(result.rows[0].id);
}

export async function updateActivityEvent(id: number, event: Partial<ActivityEvent>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  
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
  await query(`UPDATE activity_events SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
}

export async function deleteActivityEvent(id: number): Promise<void> {
  await query('DELETE FROM activity_events WHERE id = $1', [id]);
}

export async function getActivityEvents(days: number = 365): Promise<ActivityEventParsed[]> {
  const since = shiftDate(getToday(), -days);
  const result = await query(
    'SELECT * FROM activity_events WHERE event_date >= $1 ORDER BY event_date DESC',
    [since]
  );
  return result.rows.map(row => ({
    ...row,
    collected_data: JSON.parse(row.collected_data || '{}')
  }));
}

export async function getActivityEventsByDateRange(startDate: string, endDate: string): Promise<ActivityEventParsed[]> {
  const result = await query(
    'SELECT * FROM activity_events WHERE event_date >= $1 AND event_date <= $2 ORDER BY event_date DESC',
    [startDate, endDate]
  );
  return result.rows.map(row => ({
    ...row,
    collected_data: JSON.parse(row.collected_data || '{}')
  }));
}

export async function getAllActivityEvents(): Promise<ActivityEventParsed[]> {
  const result = await query('SELECT * FROM activity_events ORDER BY event_date DESC');
  return result.rows.map(row => ({
    ...row,
    collected_data: JSON.parse(row.collected_data || '{}')
  }));
}

export async function getActivityEventById(id: number): Promise<ActivityEventParsed | null> {
  const result = await query('SELECT * FROM activity_events WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    collected_data: parseCollectedData(row.collected_data)
  };
}

export async function getActivityMaterialCounts(eventId: number): Promise<Record<string, number>> {
  const result = await query(
    `SELECT material_type, COUNT(*)::integer AS count
     FROM activity_materials WHERE event_id = $1 GROUP BY material_type`,
    [eventId],
  );
  return Object.fromEntries(result.rows.map(row => [row.material_type, Number(row.count)]));
}

export async function getDashboardUpdatedAt(): Promise<string | null> {
  const result = await query(`
    SELECT MAX(updated_at) AS updated_at
    FROM (
      SELECT MAX(updated_at) AS updated_at FROM github_stats
      UNION ALL SELECT MAX(updated_at) FROM contributor_stats
      UNION ALL SELECT MAX(updated_at) FROM social_stats
      UNION ALL SELECT MAX(updated_at) FROM article_stats
      UNION ALL SELECT MAX(updated_at) FROM download_stats
      UNION ALL SELECT MAX(updated_at) FROM activity_events
    ) freshness
  `);
  const value = result.rows[0]?.updated_at;
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
