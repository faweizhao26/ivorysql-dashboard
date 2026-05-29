import * as fs from 'fs';
import { Pool } from 'pg';

const envContent = fs.readFileSync('/Users/felixzhao/ivorysql-dashboard/.env.local', 'utf-8');
const url = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim() || '';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const platformMap: Record<string, string> = {
  '公众号': 'wechat', 'CSDN': 'csdn', 'ITPUB': 'itpub', 'OSC': 'oschina',
  '墨天轮': 'modb', '知乎': 'zhihu', '头条号': 'toutiao', '掘金': 'juejin',
  '思否': 'sf', '博客园': 'cnblogs', '51CTO': 'ctoutiao', 'IFCLUB': 'ifclub',
};

async function main() {
  const data = JSON.parse(fs.readFileSync('/tmp/articles.json', 'utf-8'));

  let total = 0;
  for (const [sheetName, articles] of Object.entries(data)) {
    const platform = platformMap[sheetName];
    if (!platform) { console.log(`Unknown: ${sheetName}`); continue; }
    if (!Array.isArray(articles)) continue;

    const list = articles as any[];
    console.log(`\n${sheetName} → ${platform}: ${list.length} articles`);

    // Delete old, then batch insert
    await pool.query('DELETE FROM article_details WHERE platform = $1', [platform]);

    let saved = 0;
    for (const article of list) {
      try {
        await pool.query(
          `INSERT INTO article_details (date, platform, article_title, article_url, views, likes, comments, content_category, content_source, published_date)
           VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, $8)`,
          [article.date, platform, article.title, article.url || null,
           article.views, article.category || null, article.source || null, article.date]
        );
        saved++;
      } catch (err: any) {
        console.error(`  Error: ${article.title?.substring(0, 30)}: ${err.message}`);
      }
    }
    total += saved;
    console.log(`  Done: ${saved}`);
  }

  console.log(`\nTotal: ${total}`);
  await pool.end();
}

main().catch(console.error);
