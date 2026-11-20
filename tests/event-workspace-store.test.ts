import assert from 'node:assert/strict';
import test from 'node:test';
import type { withDbTransaction } from '../src/lib/db';
import { defaultWorkspace } from '../src/lib/event-workspace';
import { EventConflict, writeWorkspaceEvent } from '../src/lib/event-workspace-store';

function transaction(old: Record<string, unknown> | null) {
  const writes: { sql: string; values: unknown[] }[] = [];
  const run: typeof withDbTransaction = operation => operation({ query: async (sql: string, values: unknown[]) => {
    if (sql.startsWith('SELECT')) return { rows: old ? [old] : [] };
    writes.push({ sql, values }); return { rows: [{ id: 17 }] };
  } } as never);
  return { run, writes };
}
test('updating an existing event preserves ID and unrelated metadata and appends schedule history', async () => {
  const w = { ...defaultWorkspace(), month: '2026-11', tasks: [{ id: 'task', title: '确认场地', owner: '', due: '', done: false }] };
  const old = { id: 17, event_name: '活动', event_date: '', event_type: 'meetup', updated_at: '2026-11-19T00:00:00.000Z', collected_data: JSON.stringify({ legacy: { total: 4 }, workspace: w }) };
  const tx = transaction(old);
  const id = await writeWorkspaceEvent({ event_date: '2026-12-12', updated_at: old.updated_at, collected_data: { workspace: { ...w, month: '2026-12' } } }, 17, tx.run);
  assert.equal(id, 17); assert.equal(tx.writes.length, 1);
  const data = JSON.parse(String(tx.writes[0].values[8]));
  assert.equal(data.legacy.total, 4); assert.equal(data.workspace.tasks[0].id, 'task');
  assert.equal(data.workspace.original_month, '2026-11');
  assert.equal(data.workspace.schedule_history[0].from, '2026-11');
  assert.equal(data.workspace.schedule_history[0].to, '2026-12-12');
});
test('stale updates fail without overwriting saved tasks', async () => {
  const tx = transaction({ id: 17, updated_at: '2026-11-20T00:00:00Z' });
  await assert.rejects(writeWorkspaceEvent({ updated_at: '2026-11-19T00:00:00Z' },17,tx.run),EventConflict);
  assert.equal(tx.writes.length,0);
});
test('reversed dates fail before the insert and unknown dates are not fabricated', async () => {
  const tx=transaction(null);
  const input={event_name:'计划',event_date:'2026-12-12',event_type:'meetup',collected_data:{workspace:{...defaultWorkspace(),end_date:'2026-12-11'}}};
  await assert.rejects(writeWorkspaceEvent(input,undefined,tx.run),/结束日期/);
  assert.equal(tx.writes.length,0);
  await writeWorkspaceEvent({...input,event_date:'',collected_data:{workspace:defaultWorkspace()}},undefined,tx.run);
  assert.equal(tx.writes[0].values[1],'');
});
