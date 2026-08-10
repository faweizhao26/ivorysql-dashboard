import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateContributorActivity, aggregateMonthlyContributorActivity } from '../src/lib/contributor-activity';

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

test('groups 2026 activity by month and marks first-time contributors', () => {
  const result = aggregateMonthlyContributorActivity([
    {
      number: 1,
      type: 'issue',
      author: 'alice',
      created_at: '2025-12-20',
      title: 'Old issue',
      url: 'https://github.com/IvorySQL/IvorySQL/issues/1',
    },
    {
      number: 2,
      type: 'issue',
      author: 'alice',
      created_at: '2026-01-05',
      title: 'Fix docs',
      url: 'https://github.com/IvorySQL/IvorySQL/issues/2',
    },
    {
      number: 3,
      type: 'pr',
      author: 'bob',
      created_at: '2026-01-06',
      title: 'Improve tests',
      url: 'https://github.com/IvorySQL/IvorySQL/pull/3',
    },
    {
      number: 4,
      type: 'issue',
      author: 'alice',
      created_at: '2026-02-01',
      title: 'Follow-up',
      url: 'https://github.com/IvorySQL/IvorySQL/issues/4',
    },
    {
      number: 4,
      type: 'issue',
      author: 'alice',
      created_at: '2026-02-01',
      title: 'Follow-up',
      url: 'https://github.com/IvorySQL/IvorySQL/issues/4',
    },
  ], 2026);

  assert.deepEqual(result, [
    {
      month: '2026-01',
      contributor_count: 2,
      new_contributor_count: 1,
      issue_count: 1,
      pr_count: 1,
      new_contributors: ['bob'],
      contributors: [
        { login: 'alice', issue_count: 1, pr_count: 0, total: 1 },
        { login: 'bob', issue_count: 0, pr_count: 1, total: 1 },
      ],
      contributions: [
        {
          number: 2,
          type: 'issue',
          author: 'alice',
          created_at: '2026-01-05',
          title: 'Fix docs',
          url: 'https://github.com/IvorySQL/IvorySQL/issues/2',
        },
        {
          number: 3,
          type: 'pr',
          author: 'bob',
          created_at: '2026-01-06',
          title: 'Improve tests',
          url: 'https://github.com/IvorySQL/IvorySQL/pull/3',
        },
      ],
    },
    {
      month: '2026-02',
      contributor_count: 1,
      new_contributor_count: 0,
      issue_count: 1,
      pr_count: 0,
      new_contributors: [],
      contributors: [
        { login: 'alice', issue_count: 1, pr_count: 0, total: 1 },
      ],
      contributions: [
        {
          number: 4,
          type: 'issue',
          author: 'alice',
          created_at: '2026-02-01',
          title: 'Follow-up',
          url: 'https://github.com/IvorySQL/IvorySQL/issues/4',
        },
      ],
    },
  ]);
});
