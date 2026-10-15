import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Pool } from 'pg';
import { aggregateContributorSummary, type ContributorActivityItem } from '../src/lib/contributor-activity';

const issue = (number: number, author: string, created_at: string): ContributorActivityItem =>
  ({ number, type: 'issue', author, created_at, status: 'open' });
const pr = (number: number, author: string, created_at: string, merged_at?: string): ContributorActivityItem =>
  ({ number, type: 'pr', author, created_at, merged_at, status: merged_at ? 'merged' : 'closed' });

async function runSync(
  t: TestContext,
  items: ContributorActivityItem[],
  options: { today?: string; invalidHistory?: boolean; failSecondPage?: boolean } = {},
) {
  const originalEnv = { ...process.env };
  process.env.GITHUB_TOKEN = 'test-only-token';
  process.env.GITHUB_REPO = 'test-owner/test-repo';
  process.env.DATABASE_URL = 'postgresql://invalid:invalid@invalid.invalid/test';
  t.after(() => {
    for (const key of ['GITHUB_TOKEN', 'GITHUB_REPO', 'DATABASE_URL']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });
  t.mock.timers.enable({ apis: ['Date'], now: new Date(`${options.today || '2026-10-15'}T12:00:00Z`) });
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  t.mock.method(Pool.prototype, 'connect', async () => ({
    query: async () => ({ rows: [] }),
    release: () => undefined,
  }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, values: unknown[] = []) => {
    writes.push({ sql, values });
    return { rows: [] };
  });
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init?.method || 'GET', 'GET');
    assert.ok(url.pathname.startsWith('/repos/test-owner/test-repo'));
    requests.push(url.pathname + url.search);
    const kind = url.pathname.split('/').at(-1);
    if (kind === 'test-repo') {
      return Response.json({
        stargazers_count: 123, forks_count: 12, subscribers_count: 3,
        created_at: '2021-11-01T00:00:00Z',
      });
    }
    if (kind === 'contributors') return Response.json(Array.from({ length: 42 }, (_, id) => ({ login: `coder-${id}` })));
    if (kind === 'releases' || url.searchParams.get('state') === 'open') return Response.json([]);
    assert.ok(kind === 'issues' || kind === 'pulls');
    assert.equal(url.searchParams.get('state'), 'all');
    assert.equal(url.searchParams.get('sort'), 'created');
    assert.equal(url.searchParams.get('direction'), 'desc');
    if (options.invalidHistory) return Response.json({ length: 0 });
    const page = Number(url.searchParams.get('page'));
    if (options.failSecondPage && page === 2) return new Response('unavailable', { status: 503 });
    const history = items
      .filter(item => item.type === (kind === 'pulls' ? 'pr' : 'issue'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(item => ({
        number: item.number, user: { login: item.author }, created_at: item.created_at,
        merged_at: item.merged_at || null, state: item.status === 'open' ? 'open' : 'closed',
      }));
    return Response.json(history.slice((page - 1) * 100, page * 100));
  });
  const errors: unknown[][] = [];
  const originalError = console.error;
  t.mock.method(console, 'error', (...args: unknown[]) => {
    if (args[0] === 'GitHub sync error:') errors.push(args);
    else originalError(...args);
  });
  const { syncGitHubData } = await import('../src/lib/github-sync');
  const result = await syncGitHubData();
  const summaryWrite = writes.find(write => /INSERT INTO contributor_stats\s+\(date, total_contributors/.test(write.sql));
  const activityWrite = writes.find(write => /INSERT INTO contributor_stats\s+\(date, main_repo_issue_creators/.test(write.sql));
  return { result, writes, summary: summaryWrite?.values, activity: activityWrite?.values, requests, errors };
}

test('sync persists first-ever eligible contributor counts from repository-created history', async (t) => {
  const { result, summary, activity, errors } = await runSync(t, [
    issue(1, 'before-repo', '2020-01-01'),
    issue(2, 'old', '2021-11-01'),
    issue(3, 'old', '2026-10-15'),
    issue(4, 'old-issue', '2025-12-31'),
    pr(5, 'old-pr', '2025-01-01', '2025-12-31'),
    pr(6, 'january', '2025-12-31', '2026-01-01'),
    pr(7, 'daily', '2025-06-01', '2026-10-15'),
    issue(8, 'weekly', '2026-10-09'),
    issue(9, 'outside-week', '2026-10-08'),
    issue(10, 'monthly', '2026-09-16'),
    issue(11, 'outside-month', '2026-09-15'),
    issue(12, 'quarterly', '2026-07-18'),
    issue(13, 'outside-quarter', '2026-07-17'),
    pr(14, 'previously-unmerged', '2025-12-01'),
    issue(15, 'previously-unmerged', '2026-09-20'),
    issue(15, 'previously-unmerged', '2026-09-20'),
    pr(16, 'closed-only', '2026-10-15'),
    { ...pr(17, 'open-only', '2026-10-15'), status: 'open' },
    pr(18, 'future', '2025-10-01', '2027-01-01'),
  ]);

  assert.equal(result.success, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(summary, ['2026-10-15', 42, 3, 1, 2, 5, 7, 9]);
  assert.equal(result.data?.repositoryCreatedAt, '2021-11-01');
  assert.equal(result.data?.mainRepoActivity.issue_count, 10);
  assert.equal(activity?.[11], '2021-11-01');
  assert.equal(activity?.[12], 42);
  const months = JSON.parse(String(activity?.[13]));
  assert.deepEqual(months.find((month: { month: string }) => month.month === '2026-01').new_contributors, ['january']);
  const october = months.find((month: { month: string }) => month.month === '2026-10');
  assert.deepEqual(october.year_first_contributors, ['daily', 'old', 'outside-week', 'weekly']);
  assert.deepEqual(october.new_contributors, ['daily', 'outside-week', 'weekly']);
  assert.equal(october.unmerged_pr_count, 2);
});

test('period windows cross New Year without relabeling returning contributors as new', async (t) => {
  const { summary } = await runSync(t, [
    issue(1, 'returning', '2022-01-01'),
    issue(2, 'returning', '2026-01-01'),
    issue(3, 'last-year', '2025-12-31'),
    pr(4, 'new-year', '2025-01-01', '2026-01-01'),
  ], { today: '2026-01-01' });
  assert.deepEqual(summary, ['2026-01-01', 42, 2, 1, 2, 2, 2, 1]);
});

test('2026 cumulative is capped at year end even when syncing in a later year', async (t) => {
  const { summary } = await runSync(t, [
    issue(1, 'old', '2025-12-31'),
    issue(2, 'in-2026', '2026-12-31'),
    issue(3, 'in-2027', '2027-01-01'),
  ], { today: '2027-01-01' });
  assert.deepEqual(summary, ['2027-01-01', 42, 1, 1, 2, 2, 2, 1]);
});

test('snapshot excludes future eligible dates including future merges of old PRs', async (t) => {
  const { summary } = await runSync(t, [
    issue(1, 'old', '2025-12-31'),
    issue(2, 'future-issue', '2026-01-01'),
    pr(3, 'future-merge', '2025-01-01', '2026-01-01'),
  ], { today: '2025-12-31' });
  assert.deepEqual(summary, ['2025-12-31', 42, 1, 1, 1, 1, 1, 0]);
});

test('empty complete history produces measured zeros', async (t) => {
  const { result, summary } = await runSync(t, []);
  assert.equal(result.success, true);
  assert.deepEqual(summary, ['2026-10-15', 42, 0, 0, 0, 0, 0, 0]);
});

test('invalid history cannot be persisted as a valid zero summary', async (t) => {
  const { result, writes } = await runSync(t, [], { invalidHistory: true });
  assert.equal(result.success, false);
  assert.match(result.error || '', /invalid collection/i);
  assert.deepEqual(writes, []);
});

test('a failed history page does not overwrite stored summaries with partial counts', async (t) => {
  const { result, writes, requests } = await runSync(t,
    Array.from({ length: 101 }, (_, index) => issue(index, `author-${index}`, '2026-10-15')),
    { failSecondPage: true },
  );
  assert.equal(result.success, false);
  assert.match(result.error || '', /503/);
  assert.ok(requests.some(request => request.includes('/issues?page=2')));
  assert.deepEqual(writes, []);
});

test('first-ever dates include older history found on later pages', async (t) => {
  const { result, summary, requests } = await runSync(t, [
    ...Array.from({ length: 100 }, (_, index) => issue(index, `author-${index}`, '2026-10-15')),
    issue(100, 'author-0', '2022-01-01'),
  ]);
  assert.equal(result.success, true);
  assert.deepEqual(summary, ['2026-10-15', 42, 1, 99, 99, 99, 99, 99]);
  assert.ok(requests.some(request => request.includes('/issues?page=2')));
});

test('summary rejects a merged PR with an unknown merge date instead of guessing its creation date', () => {
  assert.throws(() => aggregateContributorSummary([
    { ...pr(1, 'unknown-merge', '2025-12-31'), status: 'merged' },
  ], '2021-11-01', '2026-10-15', 2026), /Missing merge date/);
});
