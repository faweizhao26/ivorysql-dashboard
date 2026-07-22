import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomDateRange } from '../src/components/TimeRangeSelector';

test('custom date ranges use the new input values', () => {
  assert.deepEqual(
    createCustomDateRange('2026-07-01', '2026-07-22'),
    { start: '2026-07-01', end: '2026-07-22', isSingleDay: false }
  );
});
