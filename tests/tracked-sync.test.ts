import assert from 'node:assert/strict';
import test from 'node:test';
import type { SyncRunResult, SyncTrigger } from '../src/lib/sync-runs';
import { runTrackedSync, type SyncTracker } from '../src/lib/tracked-sync';

function trackerFixture() {
  const starts: Array<{ platform: string; trigger: SyncTrigger }> = [];
  const finishes: Array<{ id: number; result: SyncRunResult }> = [];
  const tracker: SyncTracker = {
    async start(platform, trigger) {
      starts.push({ platform, trigger });
      return 77;
    },
    async finish(id, result) {
      finishes.push({ id, result });
    },
  };
  return { tracker, starts, finishes };
}

test('returns collector value and records a successful run', async () => {
  const fixture = trackerFixture();
  const result = await runTrackedSync(
    { platform: 'sf', trigger: 'vercel_cron', tracker: fixture.tracker },
    async () => ({ value: { articles: 48 }, recordsSeen: 50, recordsWritten: 48 }),
  );

  assert.deepEqual(result, { runId: 77, value: { articles: 48 } });
  assert.deepEqual(fixture.starts, [{ platform: 'sf', trigger: 'vercel_cron' }]);
  assert.deepEqual(fixture.finishes, [{
    id: 77,
    result: { status: 'success', recordsSeen: 50, recordsWritten: 48 },
  }]);
});

test('records partial counts and rethrows a collector error', async () => {
  const fixture = trackerFixture();
  const error = Object.assign(new Error('upstream unavailable'), {
    recordsSeen: 12,
    recordsWritten: 3,
  });

  await assert.rejects(
    runTrackedSync(
      { platform: 'modb', trigger: 'manual', tracker: fixture.tracker },
      async () => { throw error; },
    ),
    /upstream unavailable/,
  );
  assert.deepEqual(fixture.finishes, [{
    id: 77,
    result: {
      status: 'failed',
      recordsSeen: 12,
      recordsWritten: 3,
      errorMessage: 'upstream unavailable',
    },
  }]);
});

test('preserves ego-lite as the browser import trigger', async () => {
  const fixture = trackerFixture();
  await runTrackedSync(
    { platform: 'zhihu', trigger: 'ego_lite', tracker: fixture.tracker },
    async () => ({ value: true, recordsSeen: 1, recordsWritten: 1 }),
  );
  assert.equal(fixture.starts[0].trigger, 'ego_lite');
});
