export interface RuntimeEnv {
  NODE_ENV?: string;
  ALLOW_SAMPLE_DATA?: string;
}

export interface SampleAuditQuery {
  table: string;
  sql: string;
  reason: string;
}

const RETIRED_REMINDER_PLATFORMS = new Set(['juejin']);

export function isSampleSeedAllowed(env: RuntimeEnv): boolean {
  return env.NODE_ENV !== 'production' || env.ALLOW_SAMPLE_DATA === '1';
}

export function isReminderEligible(platform: string): boolean {
  return !RETIRED_REMINDER_PLATFORMS.has(platform.toLowerCase());
}

export function assertQuarantineConfirmed(confirmed: boolean): void {
  if (!confirmed) {
    throw new Error('Quarantine is disabled unless --confirm is provided');
  }
}

export function buildSampleAuditQueries(): SampleAuditQuery[] {
  return [
    {
      table: 'github_stats',
      reason: 'Matches the legacy sample seed constants',
      sql: `SELECT id, date, created_at FROM github_stats
            WHERE subscribers = 280 AND releases_count = 28
              AND stars >= 2850 AND forks >= 520`,
    },
    {
      table: 'contributor_stats',
      reason: 'Matches the legacy sample contributor baseline',
      sql: `SELECT id, date, created_at FROM contributor_stats
            WHERE contributors_before_2026 = 1280`,
    },
    {
      table: 'website_stats',
      reason: 'Matches the legacy generated website ranges',
      sql: `SELECT id, date, created_at FROM website_stats
            WHERE pageviews BETWEEN 12000 AND 16999
              AND unique_visitors BETWEEN 4000 AND 5999`,
    },
    {
      table: 'community_events',
      reason: 'Matches the legacy sample event description',
      sql: `SELECT id, date, created_at FROM community_events
            WHERE description = '社区成员积极参与讨论和贡献'`,
    },
  ];
}
