import assert from 'node:assert/strict';
import test from 'node:test';
import { planContributorCorrections, planStoredContributorCorrections } from '../scripts/audit-contributor-summaries';

test('historical corrections respect each snapshot date and exclude unmerged PRs', () => {
  const empty = { contributors_before_2026: 0, new_contributors_daily: 0, new_contributors_weekly: 0, new_contributors_monthly: 0, new_contributors_quarterly: 0, cumulative_2026: 0 };
  const plan = planContributorCorrections([{ date: '2026-01-01', ...empty }, { date: '2026-01-03', ...empty }], [
    { number: 1, author: 'old', type: 'issue', status: 'open', created_at: '2025-01-01' },
    { number: 2, author: 'returning', type: 'pr', status: 'merged', created_at: '2025-02-01', merged_at: '2026-01-03' },
    { number: 3, author: 'unmerged', type: 'pr', status: 'closed', created_at: '2026-01-01' },
  ], '2021-01-01');
  assert.equal(plan.length, 2);
  assert.equal(plan[0].corrected.cumulative_2026, 0);
  assert.equal(plan[1].corrected.cumulative_2026, 1);
  assert.equal(plan[0].corrected.contributors_before_2026, 1);
  assert.deepEqual(Object.keys(plan[0]).sort(), ['corrected', 'date', 'previous']);
  assert.equal('total_contributors' in plan[0].corrected, false);
  assert.deepEqual(planContributorCorrections([{ date: '2026-01-01', ...plan[0].corrected }], [
    { number: 1, author: 'old', type: 'issue', status: 'open', created_at: '2025-01-01' },
  ], '2021-01-01'), []);
});

test('stored activity preview validates its anchor and limits corrections to provable windows', () => {
  const anchor = { date: '2026-10-17', contributors_before_2026: 87, new_contributors_daily: 0, new_contributors_weekly: 1, new_contributors_monthly: 1, new_contributors_quarterly: 1, cumulative_2026: 1 };
  const months = [{ new_contributors: ['alice'], contributions: [
    { number: 1, type: 'pr' as const, author: 'alice', created_at: '2026-10-01', merged_at: '2026-10-15', status: 'merged' as const },
  ] }];
  const zero = { ...anchor, cumulative_2026: 0 };
  const plan = planStoredContributorCorrections([{ ...zero, date: '2026-10-14' }, { ...zero, date: '2026-10-15' }, { ...zero, date: '2026-01-05' }], anchor, months);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].corrected.cumulative_2026, 0);
  assert.equal(plan[1].corrected.cumulative_2026, 1);
  assert.equal(plan[1].corrected.new_contributors_daily, 1);
  assert.throws(() => planStoredContributorCorrections([zero], { ...anchor, new_contributors_weekly: 9 }, months), /anchor/i);
  assert.throws(() => planStoredContributorCorrections([zero], anchor, [{ new_contributors: ['missing'], contributions: [] }]), /Missing/);
});
