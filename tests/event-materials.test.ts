import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';
import { Pool } from 'pg';
import {
  deleteActivityMaterial,
  listActivityMaterials,
  saveActivityMaterial,
  updateActivityMaterial,
  validateMaterialInput,
  type ActivityMaterialType,
} from '../src/lib/activity-materials';

const materialTypes: ActivityMaterialType[] = ['photo', 'poster', 'ppt', 'video', 'article', 'other'];

test('malformed JSON field types produce validation errors, not server errors', () => {
  const base = { event_id: 1, material_type: 'photo', title: 'Photos', url: 'https://example.com/a' };
  for (const field of ['title', 'url', 'thumbnail_url', 'access_note', 'source_url']) {
    assert.throws(() => validateMaterialInput({ ...base, [field]: 123 } as never), RangeError);
  }
});

test('accepts every supported material type and a cloud link with access notes', () => {
  for (const materialType of materialTypes) {
    const input = validateMaterialInput({
      event_id: 7,
      material_type: materialType,
      title: `${materialType} material`,
      url: 'https://pan.example.com/share/abc',
      access_note: '提取码：ivory',
    });
    assert.equal(input.material_type, materialType);
    assert.equal(input.access_note, '提取码：ivory');
  }
});

test('allows note-only materials but rejects unsafe URL schemes', () => {
  const noteOnly = validateMaterialInput({
    event_id: 8,
    material_type: 'ppt',
    title: '大会 PPT',
    access_note: '公众号回复 HOW2026 获取',
  });
  assert.equal(noteOnly.url, null);

  assert.throws(() => validateMaterialInput({
    event_id: 8,
    material_type: 'photo',
    title: '现场照片',
    url: 'javascript:alert(1)',
  }), /https/);
  assert.throws(() => validateMaterialInput({
    event_id: 8,
    material_type: 'photo',
    title: '现场照片',
    thumbnail_url: 'http://insecure.example.com/photo.jpg',
  }), /https/);
});

test('schema cascades event deletion and deduplicates non-empty event URLs', () => {
  const dbSource = readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
  assert.match(dbSource, /event_id INTEGER NOT NULL REFERENCES activity_events\(id\) ON DELETE CASCADE/);
  assert.match(dbSource, /UNIQUE INDEX[\s\S]*activity_materials[\s\S]*\(event_id, url\)[\s\S]*url <> ''/);
});

test('material CRUD uses parameterized queries and stable ordering', async () => {
  const originalConnect = Pool.prototype.connect;
  const calls: Array<{ sql: string; values?: unknown[] }> = [];

  Pool.prototype.connect = async function () {
    return { query: async () => ({ rows: [] }), release: () => undefined } as never;
  };
  const queryMock = mock.method(Pool.prototype, 'query', async function (sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    return { rows: [{ id: 3, event_id: 7, material_type: 'photo', title: '现场照片', url: 'https://pan.example.com/a', sort_order: 0 }] };
  });

  try {
    await listActivityMaterials(7);
    await saveActivityMaterial({ event_id: 7, material_type: 'photo', title: '现场照片', url: 'https://pan.example.com/a' });
    await updateActivityMaterial(3, { event_id: 7, material_type: 'photo', title: '新标题', url: 'https://pan.example.com/a' });
    await deleteActivityMaterial(3);

    assert.match(calls[0].sql, /WHERE event_id = \$1 ORDER BY sort_order ASC, id ASC/);
    assert.deepEqual(calls[0].values, [7]);
    assert.match(calls[1].sql, /ON CONFLICT \(event_id, url\)/);
    assert.match(calls[2].sql, /WHERE id = \$\d+/);
    assert.deepEqual(calls.at(-1)?.values, [3]);
  } finally {
    Pool.prototype.connect = originalConnect;
    queryMock.mock.restore();
  }
});
