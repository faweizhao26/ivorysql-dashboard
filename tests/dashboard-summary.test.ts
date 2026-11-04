import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toDashboardContributorSummary, selectDashboardContributor } from '../src/lib/dashboard-summary';

const route = readFileSync(new URL('../src/app/api/dashboard/route.ts', import.meta.url), 'utf8');

test('GitHub detail requests retain contributor identities and monthly contributions', () => {
  const month = legacyMonth();
  month.year_first_contributors = ['B'];
  month.year_first_contributor_count = 1;
  const row = { date: '2026-10-13', total_contributors: 3, main_repo_monthly_activity: [month], main_repo_top_contributors: [{ login: 'A' }] };
  assert.deepEqual(selectDashboardContributor(row, true), row);
  assert.equal('main_repo_monthly_activity' in selectDashboardContributor(row, false)!, false);
});

function legacyMonth() {
  return {
    month: '2026-10', contributor_count: 3,
    year_first_contributor_count: 3, new_contributor_count: 2,
    issue_count: 3, pr_count: 0, merged_pr_count: 0, unmerged_pr_count: 0,
    year_first_contributors: ['A', 'B', 'C'], new_contributors: ['A', 'C'],
    contributors: ['A', 'B', 'C'].map(login => ({ login, issue_count: 1, pr_count: 0, merged_pr_count: 0, unmerged_pr_count: 0, total: 1 })),
    contributions: ['A', 'B', 'C'].map((author, number) => ({ number, author, type: 'issue' as const, created_at: '2026-10-01', status: 'open' as const })),
  };
}

test('detail responses correct overlapping stored cohorts without rewriting snapshots', () => {
  const stored = { date: '2026-11-04', total_contributors: 108, main_repo_monthly_activity: [legacyMonth()] };
  const before = structuredClone(stored);
  const response = selectDashboardContributor(stored, true)!;
  const months = response.main_repo_monthly_activity as ReturnType<typeof legacyMonth>[];
  assert.deepEqual(months[0].year_first_contributors, ['B']);
  assert.equal(months[0].year_first_contributor_count, 1);
  assert.deepEqual(months[0].new_contributors, ['A', 'C']);
  assert.equal(months[0].new_contributor_count, 2);
  assert.equal(months[0].contributor_count, 3);
  assert.deepEqual(months[0].contributions, stored.main_repo_monthly_activity[0].contributions);
  assert.deepEqual(stored, before);
  assert.equal(response.total_contributors, 108);
});

test('legacy snapshots without year-first fields classify only the first month of the year', () => {
  const legacy = { ...legacyMonth(), year_first_contributors: undefined, year_first_contributor_count: undefined };
  const november = { ...legacy, month: '2026-11', new_contributors: [], new_contributor_count: 0 };
  const response = selectDashboardContributor({ main_repo_monthly_activity: [november, legacy] }, true)!;
  const months = response.main_repo_monthly_activity as ReturnType<typeof legacyMonth>[];
  assert.deepEqual(months[0].year_first_contributors, []);
  assert.equal(months[0].year_first_contributor_count, 0);
  assert.deepEqual(months[1].year_first_contributors, ['B']);
  assert.equal(months[1].year_first_contributor_count, 1);
});

test('fresh database tables exist before their timestamp migrations', () => {
  const db = readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
  for (const table of ['social_stats', 'article_stats', 'article_details', 'website_stats']) {
    assert.ok(db.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`) < db.indexOf(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at`), table);
  }
});

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
