const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);
const PLATFORM = 'cnblogs';

function extractArticles(html) {
  const articles = [];
  
  const titleMatches = html.matchAll(/<a class="postTitle2[^"]*" href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g);
  
  for (const match of titleMatches) {
    const link = match[1];
    const title = match[2].trim();
    
    const dateMatch = html.substring(html.indexOf(match[0]) - 500, html.indexOf(match[0])).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    
    let date = '';
    if (dateMatch) {
      date = dateMatch[1] + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0');
    }
    
    const viewMatch = html.substring(html.indexOf(match[0]), html.indexOf(match[0]) + 1000).match(/class="post-view-count"[^>]*>阅读\((\d+)\)/);
    const views = viewMatch ? parseInt(viewMatch[1]) : 0;
    
    if (title && link) {
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

async function scrapeCnblogs() {
  const baseUrl = 'https://www.cnblogs.com/ivorysql';
  
  console.log('Scraping cnblogs...\n');
  
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

scrapeCnblogs();