import test from 'node:test';
import assert from 'node:assert/strict';
import { compareReportPeriod, reportPeriod, recentlyClosedPeriods, reportTrendRanges } from '../src/lib/report-period';

test('month, quarter and year use inclusive calendar bounds, truncating a live period', () => {
  assert.equal(reportPeriod('month', '2024-02', '2024-04-01').end, '2024-02-29');
  const q = reportPeriod('quarter', '2026-Q4', '2026-11-24');
  assert.deepEqual([q.start, q.end, q.plannedEnd, q.nextEnd, q.closed], ['2026-10-01','2026-11-24','2026-12-31','2027-03-31',false]);
  assert.equal(reportPeriod('year', '2026', '2026-12-31').closed, false);
  assert.throws(() => reportPeriod('month','2027-01','2026-11-24'), RangeError);
  assert.throws(() => reportPeriod('quarter','2026-Q5','2026-11-24'), RangeError);
});

test('January rollover includes the previous December, Q4 and year', () => {
  assert.deepEqual(recentlyClosedPeriods('2027-01-01').map(p => p.key), ['2026-12','2026-Q4','2026']);
});

test('partial comparisons use the same number of days even when the prior month is shorter', () => {
  assert.deepEqual(compareReportPeriod(reportPeriod('month', '2026-03', '2026-03-30')), {
    current: {start:'2026-03-01',end:'2026-03-28'}, prior:{start:'2026-02-01',end:'2026-02-28'},
  });
  assert.equal(compareReportPeriod(reportPeriod('month','2026-03','2026-04-01')).current.end, '2026-03-31');
  assert.deepEqual(reportTrendRanges(reportPeriod('quarter','2026-Q4','2026-11-24')), [
    {start:'2026-10-01',end:'2026-10-31'},{start:'2026-11-01',end:'2026-11-24'},
  ]);
});
