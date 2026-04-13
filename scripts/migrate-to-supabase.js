const { Client } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres:HxXsGhc3t0BTYKFZ@db.erygjskqevjqauoakccq.supabase.co:5432/postgres';
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'stats.db');

async function migrate() {
  console.log('Starting migration from SQLite to Supabase...\n');

  const localDb = new Database(LOCAL_DB_PATH);
  const supabase = new Client({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });

  await supabase.connect();
  console.log('Connected to Supabase\n');

  console.log('Clearing existing data...');
  await supabase.query('TRUNCATE TABLE github_stats, contributor_stats, social_stats, article_stats, article_details, activity_events RESTART IDENTITY CASCADE');
  console.log('Tables cleared\n');

  await initTables(supabase);

  console.log('Migrating github_stats...');
  await migrateGithubStats(localDb, supabase);

  console.log('Migrating contributor_stats...');
  await migrateContributorStats(localDb, supabase);

  console.log('Migrating social_stats...');
  await migrateSocialStats(localDb, supabase);

  console.log('Migrating article_stats...');
  await migrateArticleStats(localDb, supabase);

  console.log('Migrating article_details...');
  await migrateArticleDetails(localDb, supabase);

  console.log('Migrating activity_events...');
  await migrateActivityEvents(localDb, supabase);

  console.log('\n✅ Migration complete!');
  await supabase.end();
  localDb.close();
}

async function initTables(client) {
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
  `);
  console.log('Tables initialized\n');
}

async function migrateGithubStats(localDb, supabase) {
  const rows = localDb.prepare('SELECT * FROM github_stats').all();
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const values = batch.map((row, idx) => {
      const offset = idx * 9;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9})`;
    }).join(', ');
    
    const params = batch.flatMap(row => [row.date, row.stars, row.forks, row.watchers, row.subscribers, row.open_issues, row.open_prs, row.contributors, row.releases_count]);
    
    await supabase.query(`
      INSERT INTO github_stats (date, stars, forks, watchers, subscribers, open_issues, open_prs, contributors, releases_count)
      VALUES ${values}
      ON CONFLICT (date) DO UPDATE SET
        stars = EXCLUDED.stars,
        forks = EXCLUDED.forks,
        watchers = EXCLUDED.watchers,
        subscribers = EXCLUDED.subscribers,
        open_issues = EXCLUDED.open_issues,
        open_prs = EXCLUDED.open_prs,
        contributors = EXCLUDED.contributors,
        releases_count = EXCLUDED.releases_count
    `, params);
  }
  console.log(`  Migrated ${rows.length} rows`);
}

async function migrateContributorStats(localDb, supabase) {
  const rows = localDb.prepare('SELECT * FROM contributor_stats').all();
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const values = batch.map((row, idx) => {
      const offset = idx * 8;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8})`;
    }).join(', ');
    
    const params = batch.flatMap(row => [row.date, row.total_contributors, row.contributors_before_2026, row.new_contributors_daily, row.new_contributors_weekly, row.new_contributors_monthly, row.new_contributors_quarterly, row.cumulative_2026]);
    
    await supabase.query(`
      INSERT INTO contributor_stats (date, total_contributors, contributors_before_2026, new_contributors_daily, new_contributors_weekly, new_contributors_monthly, new_contributors_quarterly, cumulative_2026)
      VALUES ${values}
      ON CONFLICT (date) DO UPDATE SET
        total_contributors = EXCLUDED.total_contributors,
        contributors_before_2026 = EXCLUDED.contributors_before_2026,
        new_contributors_daily = EXCLUDED.new_contributors_daily,
        new_contributors_weekly = EXCLUDED.new_contributors_weekly,
        new_contributors_monthly = EXCLUDED.new_contributors_monthly,
        new_contributors_quarterly = EXCLUDED.new_contributors_quarterly,
        cumulative_2026 = EXCLUDED.cumulative_2026
    `, params);
  }
  console.log(`  Migrated ${rows.length} rows`);
}

async function migrateSocialStats(localDb, supabase) {
  const rows = localDb.prepare('SELECT date, platform, followers, posts, views, likes, shares, comments, subscribers, video_views FROM social_stats GROUP BY date, platform').all();
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const values = batch.map((row, idx) => {
      const offset = idx * 10;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10})`;
    }).join(', ');
    
    const params = batch.flatMap(row => [row.date, row.platform, row.followers, row.posts, row.views, row.likes, row.shares, row.comments, row.subscribers, row.video_views]);
    
    await supabase.query(`
      INSERT INTO social_stats (date, platform, followers, posts, views, likes, shares, comments, subscribers, video_views)
      VALUES ${values}
      ON CONFLICT (date, platform) DO UPDATE SET
        followers = EXCLUDED.followers,
        posts = EXCLUDED.posts,
        views = EXCLUDED.views,
        likes = EXCLUDED.likes,
        shares = EXCLUDED.shares,
        comments = EXCLUDED.comments,
        subscribers = EXCLUDED.subscribers,
        video_views = EXCLUDED.video_views
    `, params);
  }
  console.log(`  Migrated ${rows.length} rows`);
}

async function migrateArticleStats(localDb, supabase) {
  const rows = localDb.prepare('SELECT date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles FROM article_stats GROUP BY date, platform').all();
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const values = batch.map((row, idx) => {
      const offset = idx * 10;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10})`;
    }).join(', ');
    
    const params = batch.flatMap(row => [row.date, row.platform, row.article_count, row.total_views, row.avg_views, row.likes, row.bookmarks, row.comments, row.followers, row.new_articles]);
    
    await supabase.query(`
      INSERT INTO article_stats (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)
      VALUES ${values}
      ON CONFLICT (date, platform) DO UPDATE SET
        article_count = EXCLUDED.article_count,
        total_views = EXCLUDED.total_views,
        avg_views = EXCLUDED.avg_views,
        likes = EXCLUDED.likes,
        bookmarks = EXCLUDED.bookmarks,
        comments = EXCLUDED.comments,
        followers = EXCLUDED.followers,
        new_articles = EXCLUDED.new_articles
    `, params);
  }
  console.log(`  Migrated ${rows.length} rows`);
}

async function migrateArticleDetails(localDb, supabase) {
  const rows = localDb.prepare('SELECT * FROM article_details GROUP BY date, platform, article_title, article_url, views, likes, comments').all();
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const values = batch.map((row, idx) => {
      const offset = idx * 7;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7})`;
    }).join(', ');
    
    const params = batch.flatMap(row => [row.date, row.platform, row.article_title, row.article_url, row.views, row.likes, row.comments]);
    
    await supabase.query(`
      INSERT INTO article_details (date, platform, article_title, article_url, views, likes, comments)
      VALUES ${values}
    `, params);
  }
  console.log(`  Migrated ${rows.length} rows`);
}

async function migrateActivityEvents(localDb, supabase) {
  const rows = localDb.prepare('SELECT * FROM activity_events GROUP BY event_name, event_date, event_type, location, venue, participants, registrations, online_viewers, collected_data, description, url').all();
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const values = batch.map((row, idx) => {
      const offset = idx * 11;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11})`;
    }).join(', ');
    
    const params = batch.flatMap(row => [row.event_name, row.event_date, row.event_type, row.location || null, row.venue || null, row.participants || 0, row.registrations || 0, row.online_viewers || 0, row.collected_data || '{}', row.description || null, row.url || null]);
    
    await supabase.query(`
      INSERT INTO activity_events (event_name, event_date, event_type, location, venue, participants, registrations, online_viewers, collected_data, description, url)
      VALUES ${values}
    `, params);
  }
  console.log(`  Migrated ${rows.length} rows`);
}

migrate().catch(console.error);