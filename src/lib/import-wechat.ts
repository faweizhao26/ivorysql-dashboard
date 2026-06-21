/**
 * 生成公众号文章导入 SQL，可直接在 Supabase SQL Editor 执行
 * 用法: npx tsx src/lib/import-wechat.ts
 * 输出: /tmp/wechat-import.sql
 */
import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.join(process.env.HOME || '~', 'Downloads/工作表1.csv');
const OUTPUT_PATH = '/tmp/wechat-import.sql';
const PLATFORM = 'wechat';

interface WechatArticle {
  date: string;
  title: string;
  url: string;
  views: number;
  category: string;
  source: string;
}

function parseDate(dateStr: string): string {
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function parseCSV(content: string): WechatArticle[] {
  const lines = content.split('\n');
  const articles: WechatArticle[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = parseCSVLine(trimmed);
    if (fields.length < 6) continue;

    const dateStr = fields[0];
    const title = fields[1];
    const url = fields[2];
    const viewsStr = fields[3];
    const category = fields[4];
    const source = fields[5];

    if (dateStr === '时间' || !dateStr) continue;
    if (!dateStr.startsWith('2026')) continue;

    const date = parseDate(dateStr);
    if (!date) continue;

    articles.push({ date, title, url, views: parseInt(viewsStr, 10) || 0, category, source });
  }

  return articles;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function main() {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const articles = parseCSV(content);

  console.log(`Found ${articles.length} articles from 2026`);

  // Build SQL
  const lines: string[] = [];
  lines.push('-- IvorySQL 公众号 2026 年文章导入');
  lines.push('-- 生成时间: ' + new Date().toISOString());
  lines.push('-- 文章数: ' + articles.length);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  const dates = new Set<string>();

  for (const a of articles) {
    const title = escapeSQL(a.title);
    const url = escapeSQL(a.url);
    const cat = escapeSQL(a.category);
    const src = escapeSQL(a.source);

    lines.push(
      `INSERT INTO article_details (date, platform, article_title, article_url, views, likes, comments, content_category, content_source, published_date)` +
      ` VALUES ('${a.date}', '${PLATFORM}', '${title}', '${url}', ${a.views}, 0, 0, '${cat}', '${src}', '${a.date}')` +
      ` ON CONFLICT (date, platform, article_title) DO UPDATE SET` +
      ` article_url = EXCLUDED.article_url,` +
      ` views = EXCLUDED.views,` +
      ` content_category = EXCLUDED.content_category,` +
      ` content_source = EXCLUDED.content_source;`
    );
    dates.add(a.date);
  }

  lines.push('');
  lines.push('-- 重新计算各日期的聚合统计');
  for (const date of Array.from(dates)) {
    lines.push('');
    lines.push(`-- 日期: ${date}`);
    lines.push(`DELETE FROM article_stats WHERE platform = '${PLATFORM}' AND date = '${date}';`);
    lines.push(
      `INSERT INTO article_stats (date, platform, article_count, total_views, avg_views, likes, bookmarks, comments, followers, new_articles)` +
      ` SELECT '${date}', '${PLATFORM}',` +
      ` COUNT(*),` +
      ` COALESCE(SUM(views), 0),` +
      ` CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(views), 0) / COUNT(*)) ELSE 0 END,` +
      ` COALESCE(SUM(likes), 0),` +
      ` COALESCE(SUM(0), 0),` +
      ` COALESCE(SUM(comments), 0),` +
      ` 0,` +
      ` COUNT(*)` +
      ` FROM article_details` +
      ` WHERE platform = '${PLATFORM}' AND date = '${date}';`
    );
  }

  lines.push('');
  lines.push('-- 更新提醒时间');
  lines.push(`INSERT INTO reminder_settings (platform, update_frequency_days, reminder_enabled, last_data_updated, updated_at)`);
  lines.push(` VALUES ('${PLATFORM}', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
  lines.push(` ON CONFLICT (platform) DO UPDATE SET last_data_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP;`);
  lines.push('');
  lines.push('COMMIT;');

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');

  console.log(`\nSQL written to: ${OUTPUT_PATH}`);
  console.log(`  - ${articles.length} article INSERTs`);
  console.log(`  - ${dates.size} date stat recalculations`);
  console.log(`\nCopy the file content and run in Supabase SQL Editor.`);

  // Also print first few lines as preview
  console.log('\n--- Preview (first 3 inserts) ---');
  console.log(lines.filter(l => l.startsWith('INSERT INTO article_details')).slice(0, 3).join('\n'));
}

main();
