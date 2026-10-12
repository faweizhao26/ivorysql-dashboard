import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const allowedTables = new Set(['github_stats', 'contributor_stats', 'website_stats', 'community_events']);
const inputIndex = process.argv.indexOf('--input');
const confirmed = process.argv.includes('--confirm');

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/quarantine-sample-data.mjs --input candidates.json --confirm');
  process.exit(0);
}
if (!confirmed) throw new Error('Quarantine is disabled unless --confirm is provided');
if (inputIndex < 0 || !process.argv[inputIndex + 1]) throw new Error('--input candidates.json is required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const report = JSON.parse(await readFile(process.argv[inputIndex + 1], 'utf8'));
if (!report.read_only || !Array.isArray(report.candidates)) throw new Error('Invalid audit report');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const client = await pool.connect();
const counts = {};
try {
  await client.query('BEGIN');
  for (const candidate of report.candidates) {
    if (!allowedTables.has(candidate.table) || !Number.isInteger(candidate.id)) throw new Error('Invalid candidate');
    const selected = await client.query(`SELECT to_jsonb(source_row) AS row_data FROM ${candidate.table} source_row WHERE id = $1 FOR UPDATE`, [candidate.id]);
    if (!selected.rows[0]) continue;
    await client.query(`INSERT INTO quarantined_sample_data (source_table, source_id, row_data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (source_table, source_id) DO NOTHING`, [candidate.table, candidate.id, JSON.stringify(selected.rows[0].row_data)]);
    await client.query(`DELETE FROM ${candidate.table} WHERE id = $1`, [candidate.id]);
    counts[candidate.table] = (counts[candidate.table] || 0) + 1;
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ success: true, quarantined: counts }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
