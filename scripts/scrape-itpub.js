const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);
const PLATFORM = 'itpub';

function extractArticles(html) {
  const articles = [];
  const listItems = html.match(/<li class="list-item">([\s\S]*?)<\/li>/g) || [];
  
  for (const item of listItems) {
    const titleMatch = item.match(/<p class="title">([^<]+)<\/p>/);
    const linkMatch = item.match(/href="(https:\/\/blog\.itpub\.net\/\d+\/viewspace-\d+\/)"/);
    const viewsMatch = item.match(/icon-browse"[^>]*>([\d,]+)</);
    const dateMatch = item.match(/colorbb">([^<]+)<\/span>/);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1];
      const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : 0;
      const date = dateMatch ? dateMatch[1].trim() : '';
      
      articles.push({ title, link, views, date });
    }
  }
  
  return articles;
}

function extractTotalPages(html) {
  const match = html.match(/last"[^>]*href="[^"]*\/list\/(\d+)\/"/);
  return match ? parseInt(match[1]) : 1;
}

async function fetchPage(url) {
  const res = await fetch(url);
  return res.text();
}

async function scrapeITPub() {
  const userId = '70043484';
  const baseUrl = `https://blog.itpub.net/${userId}`;
  
  console.log('Scraping ITPub blog...\n');
  
  try {
    const html = await fetchPage(baseUrl);
    const articles = extractArticles(html);
    const totalPages = extractTotalPages(html);
    
    console.log(`Found ${articles.length} articles on page 1`);
    console.log(`Total pages: ${totalPages}\n`);
    
    const allArticles = [...articles];
    
    for (let page = 2; page <= totalPages; page++) {
      console.log(`Fetching page ${page}/${totalPages}...`);
      const pageHtml = await fetchPage(`${baseUrl}/list/${page}/`);
      const pageArticles = extractArticles(pageHtml);
      allArticles.push(...pageArticles);
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`\nTotal articles collected: ${allArticles.length}\n`);
    
    let saved = 0;
    for (const article of allArticles) {
      console.log(`  [${article.date}] ${article.title.substring(0, 50)}... (${article.views} views)`);
      
      try {
        db.prepare(`
          INSERT INTO article_details (date, platform, article_title, article_url, views, likes, comments)
          VALUES (?, ?, ?, ?, ?, 0, 0)
        `).run(article.date, PLATFORM, article.title, article.link, article.views);
        saved++;
      } catch (err) {
        if (!err.message.includes('UNIQUE')) console.error('Error:', err.message);
      }
    }
    
    console.log(`\nSaved ${saved} articles to database`);
    console.log('========== DONE ==========');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.close();
  }
}

scrapeITPub();