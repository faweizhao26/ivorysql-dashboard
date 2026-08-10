import assert from 'node:assert/strict';
import test from 'node:test';
import { getSyncHttpStatus, mergeGithubCronStats } from '../src/lib/sync-utils';

test('failed sync results return an HTTP error status', () => {
  assert.equal(getSyncHttpStatus({ success: false, error: 'upstream unavailable' }), 500);
  assert.equal(getSyncHttpStatus({ success: true }), 200);
});

test('lightweight GitHub sync preserves fields owned by the full sync', () => {
  assert.deepEqual(
    mergeGithubCronStats(
      {
        date: '2026-08-09',
        stars: 10,
        forks: 2,
        watchers: 3,
        subscribers: 3,
        open_issues: 4,
        open_prs: 5,
        contributors: 6,
        releases_count: 7,
      },
      {
        date: '2026-08-10',
        stars: 11,
        forks: 3,
        watchers: 4,
        subscribers: 4,
        open_issues: 5,
      },
    ),
    {
      date: '2026-08-10',
      stars: 11,
      forks: 3,
      watchers: 4,
      subscribers: 4,
      open_issues: 5,
      open_prs: 5,
      contributors: 6,
      releases_count: 7,
    },
  );
});
