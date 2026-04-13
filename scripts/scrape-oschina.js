const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'stats.db');
const db = new Database(dbPath);
const PLATFORM = 'oschina';
const COOKIES_FILE = path.join(process.cwd(), 'oschina-session.json');

const OSCHINA_PHONE = '18751868955';

async function loginWithSMS() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('1. Opening OSChina login page...');
    await page.goto('https://www.oschina.net/home/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log('2. Entering phone number...');
    await page.type('input[name="phone"]', OSCHINA_PHONE, { delay: 50 });

    console.log('3. Sending SMS...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('发送验证码'));
      if (btn) btn.click();
    });
    
    console.log('\n========== SMS SENT ==========');
    console.log('Please check your phone for the SMS code.');
    console.log('Enter the 6-digit code below:\n');
    
    let code = '';
    while (!code || code.length !== 6) {
      process.stdout.write('Code: ');
      code = await new Promise(resolve => {
        process.stdin.once('data', d => {
          resolve(d.toString().trim());
        });
      });
    }

    console.log('\n4. Entering SMS code: ' + code);
    await page.type('input[name="smsCode"]', code, { delay: 100 });

    console.log('5. Clicking login...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('登'));
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    const url = page.url();
    console.log('Current URL:', url);

    if (!url.includes('login') && url.includes('oschina')) {
      console.log('\n✓ Login successful!');
      
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
      console.log('Cookies saved to:', COOKIES_FILE);
      
      console.log('\n6. Scraping blog articles...');
      await page.goto('https://my.oschina.net/u/5729420', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));

      const blogItems = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.blog-item, [class*="blog-item"], article, .article-item').forEach(item => {
          const titleEl = item.querySelector('h3, h4, .title, a[href*="/blog/"]');
          const linkEl = item.querySelector('a[href*="/blog/"]');
          const dateEl = item.querySelector('[class*="date"], [class*="time"]');
          const viewEl = item.querySelector('[class*="view"], [class*="count"]');
          
          const title = titleEl?.textContent?.trim() || '';
          const link = linkEl?.href || '';
          const date = dateEl?.textContent?.trim() || '';
          const views = viewEl?.textContent?.trim() || '0';
          
          if (title && link) results.push({ title, link, date, views });
        });
        return results;
      });

      console.log(`Found ${blogItems.length} articles\n`);

      for (const article of blogItems.slice(0, 20)) {
        const views = parseInt(article.views.replace(/,/g, '')) || 0;
        const cleanTitle = article.title.replace(/\s+/g, ' ').trim();
        console.log(`  - ${cleanTitle} (${views} views)`);
        
        try {
          db.prepare(`
            INSERT INTO article_details (date, platform, article_title, article_url, views, likes, comments)
            VALUES (date('now'), ?, ?, ?, ?, 0, 0)
          `).run(PLATFORM, cleanTitle, article.link, views);
        } catch (err) {
          if (!err.message.includes('UNIQUE')) console.error('Error:', err.message);
        }
      }

      console.log('\n========== DONE ==========');
    } else {
      console.log('\n✗ Login failed. Please try again.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    db.close();
    process.exit(0);
  }
}

loginWithSMS();