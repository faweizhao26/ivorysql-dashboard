import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseEventId, parseEventListParams } from '../src/app/api/events/route';
import { validateMaterialInput } from '../src/lib/activity-materials';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('parses event pagination and combined filters', () => {
  const params = parseEventListParams(new URL(
    'https://example.com/api/events?page=2&pageSize=12&year=2026&type=meetup&search=Hangzhou',
  ).searchParams);

  assert.deepEqual(params, {
    page: 2,
    pageSize: 12,
    year: '2026',
    type: 'meetup',
    search: 'Hangzhou',
  });
});

test('rejects invalid event page bounds and filters', () => {
  for (const query of ['page=0', 'page=1.5', 'pageSize=0', 'pageSize=101', 'year=26', 'type=unknown']) {
    assert.throws(() => parseEventListParams(new URL(`https://example.com/api/events?${query}`).searchParams), RangeError);
  }
});

test('parses only positive integer route ids', () => {
  assert.equal(parseEventId('42'), 42);
  for (const value of ['0', '-1', '1.5', 'abc']) assert.throws(() => parseEventId(value), RangeError);
});

test('event queries use stable ordering and bounded pagination', () => {
  const source = read('src/lib/db.ts');
  assert.match(source, /ORDER BY e\.event_date DESC, e\.id DESC/);
  assert.match(source, /LIMIT \$\$\{values\.length \+ 1\} OFFSET \$\$\{values\.length \+ 2\}/);
  assert.match(source, /material_counts/);
});

test('detail and material routes await params and return deterministic errors', () => {
  const detail = read('src/app/api/events/[id]/route.ts');
  const materials = read('src/app/api/events/[id]/materials/route.ts');
  const material = read('src/app/api/events/[id]/materials/[materialId]/route.ts');

  assert.match(detail, /await params/);
  assert.match(detail, /status: 404/);
  assert.match(materials, /status: 400/);
  assert.match(materials, /status: 404/);
  assert.match(material, /await params/);
  assert.match(material, /status: 404/);
});

test('material validation rejects unsupported types and duplicate URLs are upserted', () => {
  assert.throws(() => validateMaterialInput({
    event_id: 1,
    material_type: 'binary' as never,
    title: 'bad',
    url: 'https://example.com/file',
  }), /type/i);
  assert.match(read('src/lib/activity-materials.ts'), /ON CONFLICT \(event_id, url\)/);
});

test('nested event mutations remain admin-protected', () => {
  const proxy = read('src/proxy.ts');
  assert.match(proxy, /requiresAdminMutation/);
  assert.match(proxy, /pathname\.startsWith\(['"]\/api\/events['"]\)/);
});
