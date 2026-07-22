import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventRangeParams } from '../src/app/api/events/route';

test('event API accepts explicit start and end date filters', () => {
  const params = getEventRangeParams(new URL('https://example.com/api/events?start=2026-07-01&end=2026-07-22').searchParams);

  assert.deepEqual(params, {
    mode: 'range',
    start: '2026-07-01',
    end: '2026-07-22',
  });
});
