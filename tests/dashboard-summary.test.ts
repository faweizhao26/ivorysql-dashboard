import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toDashboardContributorSummary } from '../src/lib/dashboard-summary';

const route = readFileSync(new URL('../src/app/api/dashboard/route.ts', import.meta.url), 'utf8');

test('dashboard route projects large database rows into page summaries', () => {
  assert.match(route, /toDashboardContributorSummary/);
  assert.match(route, /projectDataSlice/);
});

test('download history is opt-in instead of part of every dashboard response', () => {
  assert.match(route, /includeDownloads/);
  assert.match(route, /searchParams\.get\(['"]include['"]\)/);
});

test('contributor dashboard summary excludes monthly activity details', () => {
  const summary = toDashboardContributorSummary({
    date: '2026-10-13',
    total_contributors: 120,
    cumulative_2026: 30,
    main_repo_monthly_activity: [{ month: '2026-10', contributors: Array(500).fill('user') }],
  });

  assert.deepEqual(summary, {
    date: '2026-10-13',
    total_contributors: 120,
    contributors_before_2026: undefined,
    cumulative_2026: 30,
    new_contributors_daily: undefined,
    new_contributors_monthly: undefined,
    main_repo_code_contributors: undefined,
  });
  assert.equal('main_repo_monthly_activity' in (summary || {}), false);
});
