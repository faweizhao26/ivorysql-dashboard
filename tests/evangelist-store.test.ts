import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import type { PoolClient } from 'pg';
import { withDbTransaction } from '../src/lib/db';
import { saveEvangelistContribution } from '../src/lib/evangelist-store';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE evangelist_participants(id INTEGER PRIMARY KEY); INSERT INTO evangelist_participants VALUES(7),(8);
    CREATE TABLE evangelist_contributions(id INTEGER PRIMARY KEY,participant_id INTEGER,category TEXT,type TEXT,title TEXT,url TEXT,points INTEGER,date TEXT,notes TEXT,rules_version TEXT DEFAULT 'legacy',article_key TEXT);`);
  const calls: string[] = [];
  const client = { query: async (text: string, values: unknown[] = []) => {
    calls.push(text);
    const ordered: unknown[] = [];
    const sql = text.replace(/ FOR UPDATE/g, '').replace(/\$(\d+)/g, (_, index) => { ordered.push(values[Number(index) - 1]); return '?'; });
    const rows = db.prepare(sql).all(...ordered as (string | number | null)[]);
    return { rows, rowCount: rows.length };
  } } as unknown as PoolClient;
  const transaction = (async (operation: (client: PoolClient) => Promise<unknown>) => {
    db.exec('BEGIN');
    try { const result = await operation(client); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }) as typeof withDbTransaction;
  return { db, transaction, calls };
}
const date = '2026-10-29';

test('atomic saves protect yearly limits and roll back a rejected contribution', async () => {
  const { db, transaction, calls } = database();
  try {
    db.prepare('INSERT INTO evangelist_contributions(participant_id,category,type,points,date) VALUES(7,?,?,?,?)').run('宣传', '转载官方动态(10/篇·上限30)', 59, date);
    await assert.rejects(saveEvangelistContribution({ participant_id: 7, category: '宣传', type: '在知乎回答中推荐 IvorySQL', points: 5, date }, transaction), /最多可计 1 分/);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM evangelist_contributions').get() as { n: number }).n, 1);
    const saved = await saveEvangelistContribution({ participant_id: 7, category: '宣传', type: '在知乎回答中推荐 IvorySQL', points: 1, date }, transaction);
    assert.equal(saved.points, 1);
    assert.equal(db.prepare('SELECT SUM(points) AS n FROM evangelist_contributions').get()?.n, 60);
    assert.match(calls[0], /evangelist_participants.*FOR UPDATE/);
  } finally { db.close(); }
});

test('classification-only historical edits preserve the approved points and nullable date', async () => {
  const { db, transaction } = database();
  try {
    db.prepare('INSERT INTO evangelist_contributions(id,participant_id,category,type,points,date) VALUES(1,7,?,?,15,NULL)').run('内容创作', '官方发布技术视频(20)');
    await saveEvangelistContribution({ id: 1, participant_id: 7, category: '内容创作', type: '授权官方渠道发布 IvorySQL 技术视频', points: 15, date: null, notes: '历史补充' }, transaction);
    const row = db.prepare('SELECT points,date,rules_version,notes FROM evangelist_contributions WHERE id=1').get();
    assert.deepEqual({ ...row }, { points: 15, date: null, rules_version: 'legacy', notes: '历史补充' });
    await assert.rejects(saveEvangelistContribution({ id: 1, participant_id: 8, category: '内容创作', type: '授权官方渠道发布 IvorySQL 技术视频', points: 15, date }, transaction), /不属于/);
  } finally { db.close(); }
});

test('linked article saves award 15 remaining points and reject a duplicate path', async () => {
  const { db, transaction } = database();
  try {
    const first = await saveEvangelistContribution({ participant_id: 7, category: '内容创作', type: '授权官方渠道发布 IvorySQL 技术文章', points: 30, date, title: '兼容实践' }, transaction);
    assert.ok(first.id);
    await saveEvangelistContribution({ participant_id: 7, category: '内容创作', type: '本人渠道发布 IvorySQL 技术文章', points: 15, date, title: '个人版标题', article_key: '兼容实践' }, transaction);
    await assert.rejects(saveEvangelistContribution({ participant_id: 7, category: '内容创作', type: '本人渠道发布 IvorySQL 技术文章', points: 15, date, title: '个人版标题', article_key: '兼容实践' }, transaction), /最多可计 0 分/);
    assert.equal(db.prepare('SELECT SUM(points) AS n FROM evangelist_contributions').get()?.n, 45);
  } finally { db.close(); }
});
