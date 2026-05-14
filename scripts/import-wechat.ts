import { Pool } from 'pg';
import * as fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.erygjskqevjqauoakccq:HxXsGhc3t0BTYKFZ@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const html = fs.readFileSync('/Users/felixzhao/Downloads/1.xls', 'utf-8');
  const tdRegex = new RegExp('<td[^>]*>([^<]*)</td>', 'g');
  const cells: string[] = [];
  let match;
  while ((match = tdRegex.exec(html)) !== null) {
    cells.push(match[1].trim());
  }

  const data: { date: string; followers: number }[] = [];

  // Skip header: find first date row
  let startIdx = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]?.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)) {
      startIdx = i;
      break;
    }
  }

  for (let i = startIdx; i < cells.length; i++) {
    const dateMatch = cells[i]?.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!dateMatch) continue;
    const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    // cells[i+0]=date, i+1=new, i+2=unfollow, i+3=net, i+4=cumulative
    const followers = parseInt(cells[i + 4]) || 0;
    if (followers > 0) {
      data.push({ date, followers });
      console.log(`${date}: ${followers}`);
    }
    i += 4; // skip to next date row
  }

  console.log(`\nParsed ${data.length} rows. Inserting into social_stats...`);

  for (const row of data) {
    await pool.query(`
      INSERT INTO social_stats (date, platform, followers, posts, views, likes, shares, comments, subscribers, video_views)
      VALUES ($1, 'wechat', $2, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (date, platform) DO UPDATE SET followers = $2
    `, [row.date, row.followers]);
  }

  console.log('Done!');
  await pool.end();
}

main().catch(console.error);
