import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Pool } from 'pg';
import { POST } from '../src/app/api/events/[id]/materials/route';
import { PUT } from '../src/app/api/events/[id]/materials/[materialId]/route';
import { saveActivityMaterial } from '../src/lib/activity-materials';

const existing = {
  id: 3, event_id: 7, material_type: 'ppt', title: 'Original slides',
  url: 'https://pan.example.com/slides', thumbnail_url: 'https://example.com/preview.png',
  access_note: 'code: ivory', source_url: 'https://ivorysql.org/event', sort_order: 4,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

function database(t: TestContext, duplicate = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const stored = { ...existing };
  // Both initialization and application queries stay in memory; no pg connection is opened.
  t.mock.method(Pool.prototype, 'connect', async () => ({
    query: async () => ({ rows: [], rowCount: 0 }), release() {},
  }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (/SELECT \* FROM activity_events/.test(sql)) {
      return { rows: [{ id: 7, collected_data: {} }], rowCount: 1 };
    }
    if (/SELECT \* FROM activity_materials/.test(sql)) {
      return { rows: [stored], rowCount: 1 };
    }
    if (/INSERT INTO activity_materials/.test(sql) && duplicate && !/DO UPDATE/.test(sql)) {
      throw Object.assign(new Error('duplicate event URL'), { code: '23505' });
    }
    if (/INSERT INTO activity_materials|UPDATE activity_materials/.test(sql)) {
      const [event_id, material_type, title, url, thumbnail_url, access_note, source_url, sort_order] = values!;
      Object.assign(stored, { event_id, material_type, title, url, thumbnail_url, access_note, source_url, sort_order });
      return { rows: [stored], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { calls, stored };
}

function request(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/events/7/materials', {
    method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
}

test('duplicate manual POST returns 409 without overwriting existing notes or metadata', async t => {
  const db = database(t, true);
  const response = await POST(request({ material_type: 'ppt', title: 'Replacement', url: existing.url }), {
    params: Promise.resolve({ id: '7' }),
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /already exists/);
  assert.deepEqual(db.stored, existing);
  const writes = db.calls.filter(call => /INSERT|UPDATE/.test(call.sql));
  assert.equal(writes.length, 1);
  assert.doesNotMatch(writes[0].sql, /ON CONFLICT|UPDATE/);
});

test('manual POST creates a normalized material with a parameterized plain INSERT', async t => {
  const db = database(t);
  const response = await POST(request({
    event_id: 99, material_type: 'ppt', title: ' New slides ',
    url: 'https://pan.example.com/new', access_note: ' code: 1234 ',
  }), { params: Promise.resolve({ id: '7' }) });
  assert.equal(response.status, 201);
  const { material } = await response.json();
  assert.equal(material.event_id, 7);
  assert.equal(material.title, 'New slides');
  assert.equal(material.access_note, 'code: 1234');
  assert.deepEqual(db.calls[1].values, [7, 'ppt', 'New slides', 'https://pan.example.com/new', null, 'code: 1234', null, 0]);
  assert.match(db.calls[1].sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8\)/);
  assert.doesNotMatch(db.calls[1].sql, /ON CONFLICT|UPDATE/);
});

test('manual POST still accepts note-only materials', async t => {
  database(t);
  const response = await POST(request({ material_type: 'ppt', title: 'Slides', access_note: 'Ask the organizer' }), {
    params: Promise.resolve({ id: '7' }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).material.url, null);
});

test('manual POST rejects invalid URLs without inserting a material', async t => {
  const db = database(t);
  const response = await POST(request({ material_type: 'ppt', title: 'Slides', url: 'javascript:alert(1)' }), {
    params: Promise.resolve({ id: '7' }),
  });
  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 1);
});

test('PUT remains the explicit path for updating a material and its access note', async t => {
  const db = database(t);
  const response = await PUT(request({
    material_type: 'ppt', title: 'Updated slides', url: existing.url, access_note: 'code: new',
  }, 'PUT'), { params: Promise.resolve({ id: '7', materialId: '3' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).material.access_note, 'code: new');
  assert.match(db.calls[2].sql, /UPDATE activity_materials[\s\S]*WHERE id = \$9/);
  assert.equal(db.calls[2].values?.[8], 3);
});

test('saveActivityMaterial retains its existing upsert contract for non-create callers', async t => {
  const db = database(t, true);
  const material = await saveActivityMaterial({
    event_id: 7, material_type: 'ppt', title: 'Updated slides', url: existing.url, access_note: 'code: kept',
  });
  assert.equal(material.id, 3);
  assert.equal(material.access_note, 'code: kept');
  assert.match(db.calls[0].sql, /ON CONFLICT \(event_id, url\)[\s\S]*DO UPDATE/);
});
