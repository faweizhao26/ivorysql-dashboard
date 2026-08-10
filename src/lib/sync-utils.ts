export interface GithubStatsSnapshot {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  subscribers: number;
  open_issues: number;
  open_prs: number;
  contributors: number;
  releases_count: number;
}

export interface GithubLightweightSnapshot {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  subscribers: number;
  open_issues: number;
}

export function getSyncHttpStatus(result: { success: boolean }): number {
  return result.success ? 200 : 500;
}

export function mergeGithubCronStats(
  previous: GithubStatsSnapshot | null,
  current: GithubLightweightSnapshot,
): GithubStatsSnapshot {
  return {
    ...current,
    open_prs: previous?.open_prs || 0,
    contributors: previous?.contributors || 0,
    releases_count: previous?.releases_count || 0,
  };
}
