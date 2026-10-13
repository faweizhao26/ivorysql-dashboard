import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { getDashboardUpdatedAt, getStalePlatforms } from '../src/lib/db';
import {
  finishSyncRun,
  getLatestSyncStatus,
  isSyncStatus,
  isSyncTrigger,
  startSyncRun,
} from '../src/lib/sync-runs';

test('accepts only supported sync statuses and triggers', () => {
  assert.equal(isSyncStatus('running'), true);
  assert.equal(isSyncStatus('success'), true);
  assert.equal(isSyncStatus('failed'), true);
  assert.equal(isSyncStatus('partial'), false);
  assert.equal(isSyncTrigger('vercel_cron'), true);
  assert.equal(isSyncTrigger('ego_lite'), true);
  assert.equal(isSyncTrigger('manual'), true);
  assert.equal(isSyncTrigger('unknown'), false);
});

test('starts and finishes a successful sync with counts', async () => {
  const originalConnect = Pool.prototype.connect;
  const originalQuery = Pool.prototype.query;
  const calls: Array<{ sql: string; values?: unknown[] }> = [];

  Pool.prototype.connect = async function () {
    return {
      query: async () => ({ rows: [] }),
      release: () => undefined,
    } as never;
  };
  Pool.prototype.query = async function (sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (/INSERT INTO sync_runs/.test(sql)) return { rows: [{ id: 41 }] } as never;
    return { rows: [] } as never;
  };

  try {
    const id = await startSyncRun('sf', 'vercel_cron');
    await finishSyncRun(id, { status: 'success', recordsSeen: 50, recordsWritten: 48 });

    assert.equal(id, 41);
    assert.match(calls[0].sql, /INSERT INTO sync_runs/);
    assert.deepEqual(calls[0].values, ['sf', 'vercel_cron']);
    assert.match(calls[1].sql, /finished_at = CURRENT_TIMESTAMP/);
    assert.deepEqual(calls[1].values, ['success', 50, 48, null, 41]);
  } finally {
    Pool.prototype.connect = originalConnect;
    Pool.prototype.query = originalQuery;
  }
});

test('records partial counts and bounds a failed sync error', async () => {
  const originalQuery = Pool.prototype.query;
  let values: unknown[] = [];
  Pool.prototype.query = async function (_sql: string, queryValues?: unknown[]) {
    values = queryValues || [];
    return { rows: [] } as never;
  };

  try {
    await finishSyncRun(9, {
      status: 'failed',
      recordsSeen: 17,
      recordsWritten: 4,
      errorMessage: 'x'.repeat(1500),
    });

    assert.equal(values[0], 'failed');
    assert.equal(values[1], 17);
    assert.equal(values[2], 4);
    assert.equal((values[3] as string).length, 1000);
    assert.equal(values[4], 9);
  } finally {
    Pool.prototype.query = originalQuery;
  }
});

test('returns latest status per platform and page-level update time', async () => {
  const originalQuery = Pool.prototype.query;
  Pool.prototype.query = async function (sql: string) {
    if (/DISTINCT ON \(platform\)/.test(sql)) {
      return {
        rows: [{
          id: 5,
          platform: 'github',
          started_at: '2026-10-12T00:00:00.000Z',
          finished_at: '2026-10-12T00:01:00.000Z',
          status: 'success',
          records_seen: 20,
          records_written: 20,
          error_message: null,
          trigger: 'vercel_cron',
        }],
      } as never;
    }
    return { rows: [{ updated_at: '2026-10-12T08:30:00.000Z' }] } as never;
  };

  try {
    const statuses = await getLatestSyncStatus();
    const updatedAt = await getDashboardUpdatedAt();
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0].platform, 'github');
    assert.equal(statuses[0].status, 'success');
    assert.equal(updatedAt, '2026-10-12T08:30:00.000Z');
  } finally {
    Pool.prototype.query = originalQuery;
  }
});

test('keeps the last successful time separate from a newer failed run', async () => {
  const originalQuery = Pool.prototype.query;
  Pool.prototype.query = async function (sql: string) {
    assert.match(sql, /MAX\(finished_at\).*FILTER\s*\(WHERE status = 'success'\)/s);
    return { rows: [{ platform: 'zhihu', status: 'failed', started_at: new Date('2026-10-13T01:00:00Z'), finished_at: new Date('2026-10-13T01:01:00Z'), last_success_at: new Date('2026-10-12T01:01:00Z') }] } as never;
  };
  try {
    const [status] = await getLatestSyncStatus();
    assert.equal(status.status, 'failed');
    assert.equal(status.last_success_at, '2026-10-12T01:01:00.000Z');
  } finally { Pool.prototype.query = originalQuery; }
});

test('stale reminders use successful runs and retain manual-only timestamps', async () => {
  const originalQuery = Pool.prototype.query;
  const old = new Date(Date.now() - 12 * 86400000);
  Pool.prototype.query = async function (sql: string) {
    assert.match(sql, /status = 'success'/);
    assert.match(sql, /last_data_updated/);
    return { rows: [
      { platform: 'zhihu', update_frequency_days: 7, last_data_updated: new Date(), effective_updated_at: old },
      { platform: 'wechat', update_frequency_days: 7, effective_updated_at: new Date() },
      { platform: 'ctoutiao', update_frequency_days: 7, effective_updated_at: null },
    ] } as never;
  };
  try {
    const stale = await getStalePlatforms();
    assert.deepEqual(stale.map(item => item.platform), ['zhihu', 'ctoutiao']);
    assert.equal(stale[0].daysSinceUpdate, 12);
  } finally { Pool.prototype.query = originalQuery; }
});
