import {
  saveGitHubStats,
  saveContributorStats,
  saveMainRepoContributorStats,
  getToday,
} from '@/lib/db';
import {
  aggregateContributorActivity,
  aggregateMonthlyContributorActivity,
  type MainRepoContributorStats,
  type ContributorActivityItem,
} from '@/lib/contributor-activity';
import {
  mapGitHubRepoMetrics,
  type GitHubRepoMetrics,
  type GitHubRepositorySnapshot,
} from '@/lib/github-repo-metrics';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_MAIN_REPO = process.env.GITHUB_REPO || 'IvorySQL/IvorySQL';
const PAGE_SIZE = 100;
const CONTRIBUTION_YEAR = 2026;

interface GitHubActivityItem {
  number: number;
  created_at?: string;
  user?: { login?: string };
  pull_request?: unknown;
  title?: string;
  html_url?: string;
}

interface MainRepoContributorActivitySnapshot {
  stats: MainRepoContributorStats;
  items: ContributorActivityItem[];
}

function getMainRepoParts(): [string, string] {
  const [owner, repo] = GITHUB_MAIN_REPO.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPO: ${GITHUB_MAIN_REPO}`);
  }
  return [owner, repo];
}

async function fetchGitHubApi<T>(endpoint: string, retries = 3): Promise<T | null> {
  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not configured');
  }

  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'IvorySQL-Dashboard',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    if (res.status === 403 && retries > 0 && res.headers.get('X-RateLimit-Remaining') === '0') {
      const resetTime = res.headers.get('X-RateLimit-Reset');
      const waitSeconds = resetTime
        ? Math.max(1, parseInt(resetTime, 10) - Math.floor(Date.now() / 1000))
        : 60;
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      return fetchGitHubApi<T>(endpoint, retries - 1);
    }
    throw new Error(`GitHub API error: ${res.status} - ${endpoint}`);
  }

  return res.json() as Promise<T>;
}

async function requireGitHubApi<T>(endpoint: string): Promise<T> {
  const data = await fetchGitHubApi<T>(endpoint);
  if (data === null) {
    throw new Error(`GitHub API returned no data: ${endpoint}`);
  }
  return data;
}

async function fetchGitHubCollection<T>(endpoint: string): Promise<T[]> {
  const values: T[] = [];

  for (let page = 1; ; page++) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const data = await requireGitHubApi<T[]>(`${endpoint}${separator}page=${page}&per_page=${PAGE_SIZE}`);
    if (!Array.isArray(data)) {
      throw new Error(`GitHub API returned an invalid collection: ${endpoint}`);
    }

    values.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return values;
}

async function fetchMainRepoContributorActivity(
  owner: string,
  repo: string,
  since: string,
): Promise<MainRepoContributorActivitySnapshot> {
  const items: ContributorActivityItem[] = [];

  for (const kind of ['issues', 'pulls'] as const) {
    for (let page = 1; ; page++) {
      const data = await requireGitHubApi<GitHubActivityItem[]>(
        `/repos/${owner}/${repo}/${kind}?page=${page}&per_page=${PAGE_SIZE}&state=all&sort=created&direction=desc`,
      );
      if (data.length === 0) break;

      for (const item of data) {
        const createdAt = item.created_at?.slice(0, 10);
        if (createdAt && createdAt < since) continue;
        if (!createdAt || !item.user?.login) continue;
        if (kind === 'issues' && item.pull_request) continue;

        const activityItem: ContributorActivityItem = {
          number: item.number,
          type: kind === 'pulls' ? 'pr' : 'issue',
          author: item.user.login,
          created_at: createdAt,
        };
        if (item.title) activityItem.title = item.title;
        if (item.html_url) activityItem.url = item.html_url;
        items.push(activityItem);
      }

      const oldestDate = data[data.length - 1]?.created_at?.slice(0, 10);
      if (data.length < PAGE_SIZE || (oldestDate && oldestDate < since)) break;
    }
  }

  return {
    stats: aggregateContributorActivity(items, since, getToday()),
    items,
  };
}

export async function getMainRepoMetrics(): Promise<GitHubRepoMetrics> {
  const [owner, repo] = getMainRepoParts();
  const repository = await requireGitHubApi<GitHubRepositorySnapshot>(`/repos/${owner}/${repo}`);

  const [openIssuesData, openPrsData, contributorData, releasesData] = await Promise.all([
    fetchGitHubCollection<GitHubActivityItem>(`/repos/${owner}/${repo}/issues?state=open&sort=created&direction=desc`),
    fetchGitHubCollection<GitHubActivityItem>(`/repos/${owner}/${repo}/pulls?state=open&sort=created&direction=desc`),
    fetchGitHubCollection<unknown>(`/repos/${owner}/${repo}/contributors`),
    fetchGitHubCollection<unknown>(`/repos/${owner}/${repo}/releases`),
  ]);

  const openIssues = openIssuesData.filter(item => !item.pull_request).length;
  return mapGitHubRepoMetrics(repository, {
    open_issues: openIssues,
    open_prs: openPrsData.length,
    contributors: contributorData.length,
    releases: releasesData.length,
  });
}

export async function syncMainRepoContributorActivity(
  date = getToday(),
  since?: string,
): Promise<MainRepoContributorStats> {
  const [owner, repo] = getMainRepoParts();
  const activitySince = since || (await getMainRepoMetrics()).repository_created_at;
  const activity = await fetchMainRepoContributorActivity(owner, repo, activitySince);
  await saveMainRepoContributorStats(date, {
    ...activity.stats,
    monthly_activity: aggregateMonthlyContributorActivity(activity.items, CONTRIBUTION_YEAR),
  }, activitySince);
  return activity.stats;
}

export async function syncGitHubData(): Promise<{
  success: boolean;
  data?: {
    stars: number;
    forks: number;
    totalContributors: number;
    repositoryCreatedAt: string;
    mainRepoActivity: MainRepoContributorStats;
  };
  error?: string;
}> {
  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  try {
    const today = getToday();
    const [owner, repo] = getMainRepoParts();
    const mainStats = await getMainRepoMetrics();
    const mainRepoActivity = await fetchMainRepoContributorActivity(
      owner,
      repo,
      mainStats.repository_created_at,
    );

    await saveGitHubStats({
      date: today,
      stars: mainStats.stars,
      forks: mainStats.forks,
      watchers: mainStats.watchers,
      subscribers: mainStats.subscribers,
      open_issues: mainStats.open_issues,
      open_prs: mainStats.open_prs,
      contributors: mainStats.contributors,
      releases_count: mainStats.releases_count,
    });

    await saveContributorStats({
      date: today,
      total_contributors: mainStats.contributors,
      contributors_before_2026: 0,
      new_contributors_daily: 0,
      new_contributors_weekly: 0,
      new_contributors_monthly: 0,
      new_contributors_quarterly: 0,
      cumulative_2026: 0,
    });
    await saveMainRepoContributorStats(today, {
      ...mainRepoActivity.stats,
      code_contributors: mainStats.contributors,
      monthly_activity: aggregateMonthlyContributorActivity(mainRepoActivity.items, CONTRIBUTION_YEAR),
    }, mainStats.repository_created_at);

    return {
      success: true,
      data: {
        stars: mainStats.stars,
        forks: mainStats.forks,
        totalContributors: mainStats.contributors,
        repositoryCreatedAt: mainStats.repository_created_at,
        mainRepoActivity: mainRepoActivity.stats,
      },
    };
  } catch (error) {
    console.error('GitHub sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync GitHub data',
    };
  }
}
