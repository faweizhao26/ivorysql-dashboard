import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toDashboardContributorSummary, selectDashboardContributor } from '../src/lib/dashboard-summary';

const route = readFileSync(new URL('../src/app/api/dashboard/route.ts', import.meta.url), 'utf8');

test('GitHub detail requests retain contributor identities and monthly contributions', () => {
  const row = { date: '2026-10-13', total_contributors: 1, main_repo_monthly_activity: [{ contributors: ['person'] }], main_repo_top_contributors: [{ login: 'person' }] };
  assert.deepEqual(selectDashboardContributor(row, true), row);
  assert.equal('main_repo_monthly_activity' in selectDashboardContributor(row, false)!, false);
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
