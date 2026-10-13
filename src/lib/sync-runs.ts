import { queryDb } from './db';

export type SyncStatus = 'running' | 'success' | 'failed';
export type SyncTrigger = 'vercel_cron' | 'ego_lite' | 'manual';

export interface SyncRun {
  id: number;
  platform: string;
  started_at: string;
  finished_at: string | null;
  status: SyncStatus;
  records_seen: number;
  records_written: number;
  error_message: string | null;
  trigger: SyncTrigger;
}

export interface SyncPlatformStatus extends SyncRun {
  last_success_at: string | null;
}

export interface SyncRunResult {
  status: Exclude<SyncStatus, 'running'>;
  recordsSeen: number;
  recordsWritten: number;
  errorMessage?: string | null;
}

const SYNC_STATUSES = new Set<SyncStatus>(['running', 'success', 'failed']);
const SYNC_TRIGGERS = new Set<SyncTrigger>(['vercel_cron', 'ego_lite', 'manual']);

export function isSyncStatus(value: string): value is SyncStatus {
  return SYNC_STATUSES.has(value as SyncStatus);
}

export function isSyncTrigger(value: string): value is SyncTrigger {
  return SYNC_TRIGGERS.has(value as SyncTrigger);
}

export async function startSyncRun(platform: string, trigger: SyncTrigger): Promise<number> {
  const result = await queryDb(
    `INSERT INTO sync_runs (platform, status, trigger)
     VALUES ($1, 'running', $2)
     RETURNING id`,
    [platform, trigger],
  );
  return Number(result.rows[0].id);
}

export async function finishSyncRun(id: number, result: SyncRunResult): Promise<void> {
  const errorMessage = result.errorMessage ? result.errorMessage.slice(0, 1000) : null;
  await queryDb(
    `UPDATE sync_runs
     SET finished_at = CURRENT_TIMESTAMP,
         status = $1,
         records_seen = $2,
         records_written = $3,
         error_message = $4
     WHERE id = $5`,
    [result.status, result.recordsSeen, result.recordsWritten, errorMessage, id],
  );
}

export async function getLatestSyncStatus(): Promise<SyncPlatformStatus[]> {
  const result = await queryDb(`
    SELECT DISTINCT ON (platform)
      id, platform, started_at, finished_at, status,
      records_seen, records_written, error_message, trigger,
      MAX(finished_at) FILTER (WHERE status = 'success') OVER (PARTITION BY platform) AS last_success_at
    FROM sync_runs
    ORDER BY platform, started_at DESC, id DESC
  `);
  return result.rows.map((row) => ({
    ...row,
    started_at: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
    finished_at: row.finished_at instanceof Date ? row.finished_at.toISOString() : row.finished_at,
    last_success_at: row.last_success_at instanceof Date ? row.last_success_at.toISOString() : row.last_success_at || null,
  })) as SyncPlatformStatus[];
}
