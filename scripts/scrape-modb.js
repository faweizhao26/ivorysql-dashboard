const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);
const PLATFORM = 'modb';

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });
  return res.text();
}

function extractUserStats(html) {
  const nuxtMatch = html.match(/window\.__NUXT__=\(([\s\S]+?)\);<\/script>/);
  if (!nuxtMatch) return null;

  try {
    const nuxtData = eval('(' + nuxtMatch[0].replace('window.__NUXT__=', '').replace(/;<\/script>/, '') + ')');
    const userTotal = nuxtData?.data?.[0]?.userTotal;
    if (!userTotal) return null;

    return {
      followers: userTotal.follows || 0,
      posts: userTotal.knowledges || 0,
      views: userTotal.totalViews || 0,
      likes: userTotal.likeds || 0,
      shares: userTotal.stars || 0,
      comments: userTotal.commentCount || 0,
      subscribers: 0,
      video_views: 0
    };
  } catch (e) {
    console.error('Error parsing NUXT data:', e.message);
    return null;
  }
}

async function scrapeModb() {
  const userId = '471017';
  const url = `https://www.modb.pro/u/${userId}`;

  console.log('Scraping 墨天轮 (modb.pro)...\n');

  try {
    const html = await fetchPage(url);
    const stats = extractUserStats(html);

    if (!stats) {
      console.log('Could not extract user stats from page');
      return;
    }

    console.log('Extracted stats:');
    console.log(`  Followers: ${stats.followers}`);
    console.log(`  Posts (Knowledge): ${stats.posts}`);
    console.log(`  Views: ${stats.views}`);
    console.log(`  Likes: ${stats.likes}`);
    console.log(`  Stars/Favorites: ${stats.shares}`);
    console.log(`  Comments: ${stats.comments}`);

    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO social_stats (date, platform, followers, posts, views, likes, shares, comments, subscribers, video_views)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(today, PLATFORM, stats.followers, stats.posts, stats.views, stats.likes, stats.shares, stats.comments, stats.subscribers, stats.video_views);

    console.log(`\nSaved stats for ${today}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.close();
  }
}

scrapeModb();