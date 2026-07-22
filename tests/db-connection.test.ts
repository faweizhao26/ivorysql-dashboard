import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import {
  getDb,
  getLatestContributorStats,
  getLatestGitHubStats,
} from '../src/lib/db';

test('limits each serverless instance to one database connection', () => {
  assert.equal(getDb().options.max, 1);
});

test('shares database initialization across concurrent queries', async () => {
  const originalConnect = Pool.prototype.connect;
  const originalQuery = Pool.prototype.query;
  let connectCalls = 0;
  let finishInitialization!: () => void;
  const initializationGate = new Promise<void>((resolve) => {
    finishInitialization = resolve;
  });

  Pool.prototype.connect = async function () {
    connectCalls += 1;
    await initializationGate;
    return {
      query: async () => ({ rows: [] }),
      release: () => undefined,
    } as never;
  };
  Pool.prototype.query = async function () {
    return { rows: [] } as never;
  };

  try {
    const requests = Promise.all([
      getLatestGitHubStats(),
      getLatestContributorStats(),
    ]);

    await Promise.resolve();
    await Promise.resolve();
    finishInitialization();
    await requests;

    assert.equal(connectCalls, 1);
  } finally {
    Pool.prototype.connect = originalConnect;
    Pool.prototype.query = originalQuery;
  }
});
