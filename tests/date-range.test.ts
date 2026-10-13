import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomDateRange } from '../src/components/TimeRangeSelector';
import { createDataSlice, createPlatformFreshness } from '../src/lib/data-slices';
import { getDataRangeParams } from '../src/lib/date-query';

test('custom date ranges use the new input values', () => {
  assert.deepEqual(
    createCustomDateRange('2026-07-01', '2026-07-22'),
    { start: '2026-07-01', end: '2026-07-22', isSingleDay: false }
  );
});

test('reports exact and historical fallback dates without relabeling data', () => {
  const exact = { date: '2026-10-12', updated_at: '2026-10-12T09:00:00.000Z', value: 10 };
  assert.deepEqual(createDataSlice('2026-10-12', exact, null), {
    requested_date: '2026-10-12',
    data_date: '2026-10-12',
    updated_at: '2026-10-12T09:00:00.000Z',
    has_exact_data: true,
    data: exact,
  });

  const fallback = { date: '2026-10-01', updated_at: '2026-10-02T01:00:00.000Z', value: 8 };
  assert.deepEqual(createDataSlice('2026-10-12', null, fallback), {
    requested_date: '2026-10-12',
    data_date: '2026-10-01',
    updated_at: '2026-10-02T01:00:00.000Z',
    has_exact_data: false,
    data: fallback,
  });
  assert.deepEqual(createDataSlice('2026-10-12', null, null), {
    requested_date: '2026-10-12',
    data_date: null,
    updated_at: null,
    has_exact_data: false,
    data: null,
  });
});

test('reports mixed platform freshness independently', () => {
  const freshness = createPlatformFreshness(
    ['wechat', 'youtube'],
    '2026-10-12',
    [{ platform: 'wechat', date: '2026-10-12', updated_at: '2026-10-12T08:00:00Z' }],
    [
      { platform: 'wechat', date: '2026-10-12', updated_at: '2026-10-12T08:00:00Z' },
      { platform: 'youtube', date: '2026-09-30', updated_at: '2026-10-01T08:00:00Z' },
    ],
  );
  assert.equal(freshness.wechat.has_exact_data, true);
  assert.equal(freshness.youtube.has_exact_data, false);
  assert.equal(freshness.youtube.data_date, '2026-09-30');
});

test('rejects malformed and reversed date ranges', () => {
  assert.throws(
    () => getDataRangeParams(new URLSearchParams('start=2026-13-01&end=2026-10-12'), '2026-10-12'),
    /Invalid date/,
  );
  assert.throws(
    () => getDataRangeParams(new URLSearchParams('start=2026-10-13&end=2026-10-12'), '2026-10-12'),
    /before or equal/,
  );
  assert.throws(
    () => getDataRangeParams(new URLSearchParams('days=0'), '2026-10-12'),
    /days/,
  );
});
