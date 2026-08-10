export interface GitHubRepositorySnapshot {
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  created_at: string;
}

export interface GitHubRepositoryCounts {
  open_issues: number;
  open_prs: number;
  contributors: number;
  releases: number;
}

export interface GitHubRepoMetrics {
  stars: number;
  forks: number;
  watchers: number;
  subscribers: number;
  open_issues: number;
  open_prs: number;
  contributors: number;
  releases_count: number;
  repository_created_at: string;
}

export function formatRepositoryCreatedAt(createdAt: string): string {
  const date = createdAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid GitHub repository created_at: ${createdAt}`);
  }
  return date;
}

export function mapGitHubRepoMetrics(
  repository: GitHubRepositorySnapshot,
  counts: GitHubRepositoryCounts,
): GitHubRepoMetrics {
  return {
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    watchers: repository.subscribers_count,
    subscribers: repository.subscribers_count,
    open_issues: counts.open_issues,
    open_prs: counts.open_prs,
    contributors: counts.contributors,
    releases_count: counts.releases,
    repository_created_at: formatRepositoryCreatedAt(repository.created_at),
  };
}
