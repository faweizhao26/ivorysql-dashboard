import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateContributorActivity } from '../src/lib/contributor-activity';

test('aggregates issue and pull request creators with an inclusive end date', () => {
  const result = aggregateContributorActivity([
    { number: 1, type: 'issue', author: 'alice', created_at: '2026-01-01' },
    { number: 2, type: 'pr', author: 'alice', created_at: '2026-01-02' },
    { number: 3, type: 'issue', author: 'bob', created_at: '2026-01-03' },
    { number: 4, type: 'pr', author: 'carol', created_at: '2026-01-04' },
  ], '2026-01-01', '2026-01-03');

  assert.deepEqual(result, {
    issue_count: 2,
    pr_count: 1,
    unique_creators: 2,
    issue_creators: 2,
    pr_creators: 1,
    top_contributors: [
      { login: 'alice', issue_count: 1, pr_count: 1, total: 2 },
      { login: 'bob', issue_count: 1, pr_count: 0, total: 1 },
    ],
  });
});

test('does not double-count duplicate GitHub items', () => {
  const result = aggregateContributorActivity([
    { number: 10, type: 'issue', author: 'alice', created_at: '2026-02-01' },
    { number: 10, type: 'issue', author: 'alice', created_at: '2026-02-01' },
    { number: 10, type: 'pr', author: 'alice', created_at: '2026-02-01' },
  ], '2026-02-01', '2026-02-01');

  assert.equal(result.issue_count, 1);
  assert.equal(result.pr_count, 1);
  assert.equal(result.unique_creators, 1);
  assert.deepEqual(result.top_contributors[0], {
    login: 'alice',
    issue_count: 1,
    pr_count: 1,
    total: 2,
  });
});
