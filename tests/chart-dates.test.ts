import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateTick } from '../src/components/Charts';

test('chart date-only labels never shift to the previous day in western timezones', () => {
  const original = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(formatDateTick('2026-10-16'), '10/16');
    assert.equal(formatDateTick('2026-12-31T16:00:00Z'), '1/1');
    assert.equal(formatDateTick('not-a-date'), 'not-a-date');
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
