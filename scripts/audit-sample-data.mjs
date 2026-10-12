import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';

const queries = [
  ['github_stats', 'Matches the legacy sample seed constants', `SELECT id, date, created_at FROM github_stats WHERE subscribers = 280 AND releases_count = 28 AND stars >= 2850 AND forks >= 520`],
  ['contributor_stats', 'Matches the legacy sample contributor baseline', `SELECT id, date, created_at FROM contributor_stats WHERE contributors_before_2026 = 1280`],
  ['website_stats', 'Matches the legacy generated website ranges', `SELECT id, date, created_at FROM website_stats WHERE pageviews BETWEEN 12000 AND 16999 AND unique_visitors BETWEEN 4000 AND 5999`],
  ['community_events', 'Matches the legacy sample event description', `SELECT id, date, created_at FROM community_events WHERE description = '社区成员积极参与讨论和贡献'`],
];

function outputPath(argv) {
  const index = argv.indexOf('--output');
  return index >= 0 ? argv[index + 1] : null;
}

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/audit-sample-data.mjs [--output candidates.json]');
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
try {
  const candidates = [];
  for (const [table, reason, sql] of queries) {
    const result = await pool.query(sql);
    for (const row of result.rows) candidates.push({ table, id: row.id, date: row.date, created_at: row.created_at, reason });
  }
  const report = JSON.stringify({ generated_at: new Date().toISOString(), read_only: true, candidates }, null, 2);
  const destination = outputPath(process.argv);
  if (destination) await writeFile(destination, report, 'utf8');
  else console.log(report);
} finally {
  await pool.end();
}
