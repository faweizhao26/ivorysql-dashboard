const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);
const PLATFORM = 'juejin';

const USER_ID = '761327331579511';

function parseRelativeDate(dateStr) {
  const now = new Date();
  if (dateStr.includes('天前')) {
    const days = parseInt(dateStr.match(/(\d+)天前/)?.[1] || '0');
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  if (dateStr.includes('小时前')) {
    const hours = parseInt(dateStr.match(/(\d+)小时前/)?.[1] || '0');
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  if (dateStr.includes('分钟前')) {
    const mins = parseInt(dateStr.match(/(\d+)分钟前/)?.[1] || '0');
    return new Date(now.getTime() - mins * 60 * 1000).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function extractArticles(html) {
  const articles = [];
  
  const postItems = html.match(/<div class="post-item-content"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g) || [];
  
  for (const item of postItems) {
    const titleMatch = item.match(/<h3[^>]*>[\s\S]*?<!---->[\s\S]*?([^<]+)<\/h3>/);
    const linkMatch = item.match(/href="(\/post\/\d+)"/);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = 'https://juejin.cn' + linkMatch[1];
      
      const dateMatch = item.match(/(\d+天前|\d+小时前|\d+分钟前)/);
      const date = dateMatch ? parseRelativeDate(dateMatch[1]) : new Date().toISOString().split('T')[0];
      
      articles.push({ title, link, views: 0, date });
    }
  }
  
  return articles;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  });
  return res.text();
}

async function scrapeJuejin() {
  const baseUrl = 'https://juejin.cn/user/' + USER_ID;
  
  console.log('Scraping Juejin...\n');
  
  try {
    const allArticles = [];
    
    for (let page = 1; page <= 10; page++) {
      const url = page === 1 ? baseUrl : baseUrl + '?page=' + page;
      console.log('Fetching page ' + page + '...');
      
      const html = await fetchPage(url);
      const articles = extractArticles(html);
      
      if (articles.length === 0) {
        console.log('No more articles at page ' + page + ', stopping.');
        break;
      }
      
      allArticles.push(...articles);
      console.log('  Found ' + articles.length + ' articles');
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\nTotal articles collected: ' + allArticles.length + '\n');
    
    let saved = 0;
    const datesSet = new Set();

    for (const article of allArticles) {
      console.log('  [' + article.date + '] ' + article.title.substring(0, 50));
      
      try {
        db.prepare(
          'INSERT INTO article_details (date, platform, article_title, article_url, views, likes, comments) VALUES (?, ?, ?, ?, ?, 0, 0)'
        ).run(article.date, PLATFORM, article.title, article.link, article.views);
        datesSet.add(article.date);
        saved++;
      } catch (err) {
        if (!err.message.includes('UNIQUE')) {
          console.error('Error:', err.message);
        }
      }
    }

    console.log('\nSaved ' + saved + ' articles');
    
    for (const date of datesSet) {
      const details = db.prepare('SELECT * FROM article_details WHERE platform = ? AND date = ?').all(PLATFORM, date);
      
      const totalViews = details.reduce((sum, d) => sum + (d.views || 0), 0);
      const avgViews = details.length > 0 ? Math.round(totalViews / details.length) : 0;
      const totalLikes = details.reduce((sum, d) => sum + (d.likes || 0), 0);
      const totalComments = details.reduce((sum, d) => sum + (d.comments || 0), 0);
      
      db.prepare(
        'INSERT INTO article_stats (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?)'
      ).run(date, PLATFORM, details.length, totalViews, avgViews, totalLikes, totalComments, details.length);
    }

    console.log('Recalculated article_stats');
    console.log('========== DONE ==========');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.close();
  }
}

scrapeJuejin();