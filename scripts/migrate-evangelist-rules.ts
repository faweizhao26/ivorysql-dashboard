import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { mapLegacyContribution } from '../src/lib/evangelist-rules';

async function main() {
const root = fileURLToPath(new URL('../', import.meta.url));
loadEnvConfig(root);
const apply = process.argv.includes('--apply');
const backupArg = process.argv.find(arg => arg.startsWith('--backup='));
if (apply && !backupArg) throw new Error('--apply requires --backup=/absolute/path.json');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 15000, statement_timeout: 20000 });
const client = await pool.connect();
try {
  await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  if (apply) await client.query('LOCK TABLE evangelist_contributions IN SHARE ROW EXCLUSIVE MODE');
  const participants = (await client.query('SELECT * FROM evangelist_participants ORDER BY id')).rows;
  const before = (await client.query('SELECT * FROM evangelist_contributions ORDER BY id')).rows;
  const plan = before.map(row => ({ before: row, after: mapLegacyContribution(row) }));
  const changes = plan.filter(({ before, after }) => before.category !== after.category || before.type !== after.type);
  const groups = new Map<string, number>();
  for (const { before, after } of changes) {
    const key = `${before.category} / ${before.type} -> ${after.category} / ${after.type}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', records: before.length, reclassified: changes.length, unchanged: before.length - changes.length, mappings: [...groups].map(([mapping, records]) => ({ mapping, records })) }, null, 2));
  if (!apply) {
    await client.query('ROLLBACK');
  } else {
    const backup = resolve(backupArg!.slice('--backup='.length));
    await mkdir(dirname(backup), { recursive: true });
    await writeFile(backup, JSON.stringify({ participants, contributions: before }, null, 2), { flag: 'wx', mode: 0o600 });
    await client.query("ALTER TABLE evangelist_contributions ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT 'legacy'");
    await client.query('ALTER TABLE evangelist_contributions ADD COLUMN IF NOT EXISTS article_key TEXT');
    if (changes.length) {
      const updated = await client.query(`UPDATE evangelist_contributions AS c SET category=p.category,type=p.type
        FROM jsonb_to_recordset($1::jsonb) AS p(id integer,category text,type text)
        WHERE c.id=p.id`, [JSON.stringify(changes.map(({ after }) => ({ id: after.id, category: after.category, type: after.type })))]);
      assert.equal(updated.rowCount, changes.length);
    }
    const after = (await client.query('SELECT * FROM evangelist_contributions ORDER BY id')).rows;
    assert.equal(after.length, before.length);
    for (const original of before) {
      const actual = after.find(row => row.id === original.id);
      const expected = mapLegacyContribution(original);
      assert(actual);
      for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value, `Unexpected change ${original.id}:${field}`);
    }
    assert.deepEqual((await client.query('SELECT * FROM evangelist_participants ORDER BY id')).rows, participants);
    const totals = (rows: typeof before) => participants.map(p => ({ id: p.id, points: rows.filter(r => r.participant_id === p.id).reduce((sum, r) => sum + (r.points || 0), 0) }));
    assert.deepEqual(totals(after), totals(before));
    await client.query('COMMIT');
    console.log(JSON.stringify({ committed: true, verified_records: after.length, preserved_member_totals: participants.length, backup }));
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
