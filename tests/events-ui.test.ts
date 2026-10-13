import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventQuery, describeMaterials } from '../src/lib/events-ui';

test('event filters preserve paging and omit empty filters', () => {
  const params = buildEventQuery({ year: '2026', type: 'meetup', search: 'IvorySQL' }, 2);
  assert.equal(params.get('pageSize'), '12');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('year'), '2026');
  assert.equal(params.get('search'), 'IvorySQL');
  assert.equal(buildEventQuery({ year: '', type: '', search: '' }, 1).has('year'), false);
});

test('material summaries count links rather than pretending to count files in a drive', () => {
  assert.equal(describeMaterials({ photo: 1, ppt: 2 }), '照片 1 · PPT 2');
  assert.equal(describeMaterials({}), '暂无资料');
});
