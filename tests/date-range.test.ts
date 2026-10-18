import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomDateRange, getComparisonRange, getDateRange } from '../src/components/TimeRangeSelector';
import { createDataSlice, createPlatformFreshness } from '../src/lib/data-slices';
import { getDataRangeParams } from '../src/lib/date-query';

test('custom date ranges use the new input values', () => {
  assert.deepEqual(
    createCustomDateRange('2026-07-01', '2026-07-22'),
    { start: '2026-07-01', end: '2026-07-22', isSingleDay: false }
  );
});

test('preset ranges anchor to Beijing midnight across years', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T16:00:00Z') });
  assert.deepEqual(getDateRange('today'), { start: '2027-01-01', end: '2027-01-01', isSingleDay: true });
  for (const [preset, start] of [
    ['7d', '2026-12-26'], ['30d', '2026-12-03'], ['90d', '2026-10-04'],
    ['180d', '2026-07-06'], ['365d', '2026-01-02'], ['custom', '2026-12-03'],
  ] as const) {
    assert.deepEqual(getDateRange(preset), { start, end: '2027-01-01' });
  }
});

test('comparisons use date-only arithmetic regardless of server daylight saving time', () => {
  const range = { start: '2026-11-02', end: '2026-11-08' };
  assert.deepEqual(getComparisonRange(range, 'previous'), { start: '2026-10-26', end: '2026-11-01' });
  assert.deepEqual(getComparisonRange(range, 'year-over-year'), { start: '2025-11-02', end: '2025-11-08' });
  assert.deepEqual(getComparisonRange({ start: '2027-01-01', end: '2027-01-01' }, 'previous'), {
    start: '2026-12-31', end: '2026-12-31',
  });
  assert.deepEqual(getComparisonRange({ start: '2024-02-29', end: '2024-03-01' }, 'year-over-year'), {
    start: '2023-03-01', end: '2023-03-01',
  });
  assert.equal(getComparisonRange(range, 'custom'), null);
});

test('unfinished, invalid or reversed dates never crash comparison controls', () => {
  for (const range of [
    { start: '', end: '' }, { start: '2026-10-01', end: '' },
    { start: '2026-02-30', end: '2026-03-01' },
    { start: '2026-10-17', end: '2026-10-01' },
  ]) {
    assert.equal(getComparisonRange(range, 'previous'), null);
    assert.equal(getComparisonRange(range, 'year-over-year'), null);
    assert.equal(createCustomDateRange(range.start, range.end), null);
  }
});

test('explicit query ranges do not move with Beijing today', () => {
  assert.deepEqual(getDataRangeParams(new URLSearchParams('end=2024-03-01&days=2'), '2026-11-01'), {
    startDate: '2024-02-28', endDate: '2024-03-01', isSingleDay: false,
  });
  assert.deepEqual(getDataRangeParams(new URLSearchParams('start=2025-12-31&end=2026-01-01'), '2026-11-01'), {
    startDate: '2025-12-31', endDate: '2026-01-01', isSingleDay: false,
  });
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
