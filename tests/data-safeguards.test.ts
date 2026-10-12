import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertQuarantineConfirmed,
  buildSampleAuditQueries,
  isReminderEligible,
  isSampleSeedAllowed,
} from '../src/lib/data-safeguards';

test('denies sample seeding in production unless explicitly enabled', () => {
  assert.equal(isSampleSeedAllowed({ NODE_ENV: 'production' }), false);
  assert.equal(isSampleSeedAllowed({ NODE_ENV: 'production', ALLOW_SAMPLE_DATA: '1' }), true);
  assert.equal(isSampleSeedAllowed({ NODE_ENV: 'development' }), true);
});

test('keeps Juejin history out of update reminders', () => {
  assert.equal(isReminderEligible('juejin'), false);
  assert.equal(isReminderEligible('csdn'), true);
});

test('sample audit is read-only', () => {
  const queries = buildSampleAuditQueries();
  assert.ok(queries.length > 0);
  for (const query of queries) {
    assert.match(query.sql.trim(), /^SELECT\b/i);
    assert.doesNotMatch(query.sql, /\b(?:DELETE|UPDATE|INSERT|TRUNCATE|DROP)\b/i);
  }
});

test('quarantine requires an explicit confirmation flag', () => {
  assert.throws(() => assertQuarantineConfirmed(false), /--confirm/);
  assert.doesNotThrow(() => assertQuarantineConfirmed(true));
});
