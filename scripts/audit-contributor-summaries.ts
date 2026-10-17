import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { aggregateContributorSummary, type ContributorActivityItem } from '../src/lib/contributor-activity';
import { getBeijingDate, shiftDate } from '../src/lib/date';

type Summary = ReturnType<typeof aggregateContributorSummary>;
type Snapshot = Summary & { date: string };
const fields: Array<keyof Summary> = ['contributors_before_2026', 'new_contributors_daily', 'new_contributors_weekly', 'new_contributors_monthly', 'new_contributors_quarterly', 'cumulative_2026'];

export function planContributorCorrections(snapshots: Snapshot[], items: ContributorActivityItem[], since: string) {
  return snapshots.flatMap(snapshot => {
    const corrected = aggregateContributorSummary(items, since, snapshot.date, 2026);
    if (fields.every(field => corrected[field] === snapshot[field])) return [];
    return [{ date: snapshot.date, previous: Object.fromEntries(fields.map(field => [field, snapshot[field]])), corrected }];
  });
}

export function planStoredContributorCorrections(snapshots: Snapshot[], anchor: Snapshot, months: Array<{ new_contributors: string[]; contributions: ContributorActivityItem[] }>) {
  const names = new Set(months.flatMap(month => month.new_contributors));
  const first = new Map<string, string>();
  for (const item of months.flatMap(month => month.contributions)) {
    if (!names.has(item.author)) continue;
    const date = item.type === 'issue' ? item.created_at?.slice(0, 10) : item.status === 'merged' ? item.merged_at?.slice(0, 10) : undefined;
    if (!date || date < '2026-01-01' || date > anchor.date) continue;
    if (!first.has(item.author) || date < first.get(item.author)!) first.set(item.author, date);
  }
  for (const name of names) if (!first.has(name)) throw new Error(`Missing first contribution date for ${name}`);
  const summaryAt = (date: string): Summary => {
    const dates = [...first.values()].filter(value => value <= date);
    const count = (days: number) => dates.filter(value => value >= shiftDate(date, 1 - days)).length;
    return { contributors_before_2026: anchor.contributors_before_2026, cumulative_2026: dates.length, new_contributors_daily: count(1), new_contributors_weekly: count(7), new_contributors_monthly: count(30), new_contributors_quarterly: count(90) };
  };
  if (fields.some(field => summaryAt(anchor.date)[field] !== anchor[field])) throw new Error('Stored activity does not match the trusted anchor summary');
  return snapshots.flatMap(snapshot => {
    if (snapshot.cumulative_2026 !== 0 || snapshot.date > anchor.date || shiftDate(snapshot.date, -89) < '2026-01-01') return [];
    const corrected = summaryAt(snapshot.date);
    if (fields.every(field => corrected[field] === snapshot[field])) return [];
    return [{ date: snapshot.date, previous: Object.fromEntries(fields.map(field => [field, snapshot[field]])), corrected }];
  });
}

async function printReport(report: Record<string, unknown>) {
  const outputFlag = process.argv.indexOf('--output');
  if (outputFlag < 0) { console.log(JSON.stringify(report, null, 2)); return; }
  const output = process.argv[outputFlag + 1];
  if (!output) throw new Error('--output requires a path');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, corrections: undefined, output }));
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  loadEnvConfig(root);
  const token = process.argv.includes('--public') ? undefined : process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPO || 'IvorySQL/IvorySQL';
  if (process.argv.includes('--stored-activity')) {
    if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
    try {
      const result = await pool.query<Snapshot & { main_repo_monthly_activity: Parameters<typeof planStoredContributorCorrections>[2] }>(`SELECT date, ${fields.join(', ')}, main_repo_monthly_activity FROM contributor_stats WHERE date <= $1 ORDER BY date`, [getBeijingDate()]);
      const anchor = result.rows.at(-1);
      if (!anchor || anchor.cumulative_2026 <= 0 || !Array.isArray(anchor.main_repo_monthly_activity)) throw new Error('No corrected anchor with stored monthly activity');
      const corrections = planStoredContributorCorrections(result.rows, anchor, anchor.main_repo_monthly_activity);
      await printReport({ mode: 'read-only', source: 'stored_monthly_activity', repository, anchorDate: anchor.date, snapshots: result.rowCount, correctionCount: corrections.length, corrections });
    } finally { await pool.end(); }
    return;
  }
  if ((!token && !process.argv.includes('--public')) || !process.env.DATABASE_URL) throw new Error('Missing GITHUB_TOKEN or DATABASE_URL; public repository audits can use --public');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GITHUB_REPO');
  async function github(endpoint: string) {
    const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/vnd.github+json', 'User-Agent': 'IvorySQL-summary-audit' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub audit request failed: HTTP ${response.status}`);
    return response.json();
  }
  const metadata = await github('');
  if (typeof metadata.created_at !== 'string') throw new Error('Missing repository creation date');
  const since = metadata.created_at.slice(0, 10);
  const items: ContributorActivityItem[] = [];
  for (const kind of ['issues', 'pulls'] as const) {
    for (let page = 1; ; page++) {
      const data = await github(`/${kind}?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
      if (!Array.isArray(data)) throw new Error(`Invalid GitHub ${kind} collection`);
      for (const item of data) {
        if (kind === 'issues' && item.pull_request) continue;
        if (!item.user?.login || !item.created_at || !Number.isInteger(item.number)) throw new Error(`Incomplete ${kind} history`);
        items.push({ number: item.number, type: kind === 'issues' ? 'issue' : 'pr', author: item.user.login, created_at: item.created_at.slice(0, 10), merged_at: item.merged_at?.slice(0, 10), status: item.merged_at ? 'merged' : item.state === 'closed' ? 'closed' : 'open' });
      }
      if (data.length < 100) break;
      if (page >= 1000) throw new Error('GitHub history pagination did not finish');
    }
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
  try {
    const result = await pool.query<Snapshot>(
      `SELECT date, ${fields.join(', ')} FROM contributor_stats WHERE date >= $1 AND date <= $2 ORDER BY date`,
      [since, getBeijingDate()],
    );
    const corrections = planContributorCorrections(result.rows, items, since);
    const report = { mode: 'read-only', repository, since, snapshots: result.rowCount, activityItems: items.length, correctionCount: corrections.length, corrections };
    await printReport(report);
  } finally { await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
