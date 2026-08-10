import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGitHubRepoMetrics } from '../src/lib/github-repo-metrics';

test('maps repository metrics without treating stars as watchers', () => {
  assert.deepEqual(
    mapGitHubRepoMetrics(
      {
        stargazers_count: 1048,
        forks_count: 189,
        subscribers_count: 36,
        created_at: '2022-01-15T00:00:00Z',
      },
      { open_issues: 223, open_prs: 6, contributors: 42, releases: 26 },
    ),
    {
      stars: 1048,
      forks: 189,
      watchers: 36,
      subscribers: 36,
      open_issues: 223,
      open_prs: 6,
      contributors: 42,
      releases_count: 26,
      repository_created_at: '2022-01-15',
    },
  );
});
