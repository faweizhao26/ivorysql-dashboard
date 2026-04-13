const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);
const PLATFORM = 'csdn';

function parseCSDNDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const now = new Date();
  dateStr = dateStr.trim();
  
  if (dateStr.includes('小时前') || dateStr.includes('hours ago')) {
    const hours = parseInt(dateStr.match(/(\d+)/)?.[1] || '0');
    const d = new Date(now - hours * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (dateStr.includes('昨天')) {
    const d = new Date(now - 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (dateStr.includes('前天')) {
    const d = new Date(now - 2 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
  
  const match = dateStr.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
  if (match) {
    return match[1] + '-' + match[2] + '-' + match[3];
  }
  
  return new Date().toISOString().split('T')[0];
}

function extractArticles(html) {
  const articles = [];
  
  const articleBlocks = html.match(/<article class="blog-list-box"([\s\S]*?)<\/article>/g) || [];
  
  for (const block of articleBlocks) {
    const titleMatch = block.match(/<h4[^>]*>([^<]+)<\/h4>/);
    const linkMatch = block.match(/href="(https:\/\/blog\.csdn\.net\/[^"]+article\/details\/[^"]+)"/);
    const viewsMatch = block.match(/view-num[^>]*>\s*([^<]+)<span[^>]*>\s*阅读/);
    const dateMatch = block.match(/博文更新于\s*([^<]+)</);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1];
      
      let views = 0;
      if (viewsMatch) {
        const viewsStr = viewsMatch[1].replace(/[^\d]/g, '');
        views = parseInt(viewsStr) || 0;
      }
      
      let date = '';
      if (dateMatch) {
        date = parseCSDNDate(dateMatch[1]);
      }
      
      articles.push({ title, link, views, date });
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

async function scrapeCSDN() {
  const username = 'IvorySQL';
  const baseUrl = 'https://blog.csdn.net/' + username;
  
  console.log('Scraping CSDN blog...\n');
  
  try {
    const html = await fetchPage(baseUrl);
    const articles = extractArticles(html);
    
    console.log('Found ' + articles.length + ' articles\n');

    let saved = 0;
    const datesSet = new Set();

    for (const article of articles) {
      console.log('  [' + article.date + '] ' + article.title.substring(0, 50) + '... (' + article.views + ' views)');
      
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

scrapeCSDN();