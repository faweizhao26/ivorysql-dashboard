import {
  saveGitHubStats,
  saveContributorStats,
  getToday
} from '@/lib/db';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG || 'IvorySQL';
const GITHUB_MAIN_REPO = process.env.GITHUB_REPO || 'IvorySQL/IvorySQL';

interface ContributorInfo {
  login: string;
  years: Set<number>;
  prContributions: number;
  issueContributions: number;
}

const EXCLUDED_REPOS = new Set([
  'postgres',
  'postgresql',
  'pg',
]);

async function fetchGitHubApi(endpoint: string, retries = 3): Promise<any> {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'IvorySQL-Dashboard'
    },
    next: { revalidate: 0 }
  });

  if (!res.ok) {
    if (res.status === 403 && retries > 0) {
      const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
      if (rateLimitRemaining === '0') {
        const resetTime = res.headers.get('X-RateLimit-Reset');
        const waitSeconds = resetTime ? parseInt(resetTime) - Math.floor(Date.now() / 1000) : 60;
        console.log(`Rate limited. Waiting ${waitSeconds} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        return fetchGitHubApi(endpoint, retries - 1);
      }
    }
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.status} - ${endpoint}`);
  }

  return res.json();
}

async function getAllRepos(org: string): Promise<{ name: string; full_name: string }[]> {
  const repos: { name: string; full_name: string }[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const data = await fetchGitHubApi(`/orgs/${org}/repos?page=${page}&per_page=${perPage}&type=public`);
    if (!data || data.length === 0) break;
    repos.push(...data.map((r: any) => ({ name: r.name, full_name: r.full_name })));
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

async function getRepoCommitsWithYear(owner: string, repo: string): Promise<Map<string, Set<number>>> {
  const authors = new Map<string, Set<number>>();
  let page = 1;
  const perPage = 100;
  const maxPages = 10;
  const currentYear = new Date().getFullYear();

  while (page <= maxPages) {
    try {
      const data = await fetchGitHubApi(`/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}&author=`) as any[];
      if (!data || data.length === 0) break;

      for (const commit of data) {
        if (commit.author?.login) {
          const year = new Date(commit.commit.author.date).getFullYear();
          const existing = authors.get(commit.author.login) || new Set();
          existing.add(year);
          authors.set(commit.author.login, existing);
        }
        if (commit.committer?.login && commit.committer.login !== commit.author?.login) {
          const year = new Date(commit.commit.committer.date).getFullYear();
          const existing = authors.get(commit.committer.login) || new Set();
          existing.add(year);
          authors.set(commit.committer.login, existing);
        }
      }

      if (data.length < perPage) break;
      page++;
    } catch (e) {
      break;
    }
  }

  return authors;
}

async function getRepoIssuesWithYear(owner: string, repo: string): Promise<Map<string, Set<number>>> {
  const authors = new Map<string, Set<number>>();
  let page = 1;
  const perPage = 100;
  const maxPages = 10;

  while (page <= maxPages) {
    try {
      const data = await fetchGitHubApi(`/repos/${owner}/${repo}/issues?page=${page}&per_page=${perPage}&state=all&sort=updated`) as any[];
      if (!data || data.length === 0) break;

      for (const issue of data) {
        if (!issue.pull_request && issue.user?.login) {
          const year = new Date(issue.created_at).getFullYear();
          const existing = authors.get(issue.user.login) || new Set();
          existing.add(year);
          authors.set(issue.user.login, existing);
        }
      }

      if (data.length < perPage) break;
      page++;
    } catch (e) {
      break;
    }
  }

  return authors;
}

async function getRepoPRsWithYear(owner: string, repo: string): Promise<Map<string, Set<number>>> {
  const authors = new Map<string, Set<number>>();
  let page = 1;
  const perPage = 100;
  const maxPages = 10;

  while (page <= maxPages) {
    try {
      const data = await fetchGitHubApi(`/repos/${owner}/${repo}/pulls?page=${page}&per_page=${perPage}&state=all&sort=updated`) as any[];
      if (!data || data.length === 0) break;

      for (const pr of data) {
        if (pr.user?.login) {
          const year = new Date(pr.created_at).getFullYear();
          const existing = authors.get(pr.user.login) || new Set();
          existing.add(year);
          authors.set(pr.user.login, existing);
        }
      }

      if (data.length < perPage) break;
      page++;
    } catch (e) {
      break;
    }
  }

  return authors;
}

async function getMainRepoStats(owner: string, repo: string): Promise<{
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
}> {
  try {
    const data = await fetchGitHubApi(`/repos/${owner}/${repo}`) as any;
    return {
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      watchers: data.watchers_count || 0,
      openIssues: data.open_issues_count || 0
    };
  } catch (e) {
    return { stars: 0, forks: 0, watchers: 0, openIssues: 0 };
  }
}

async function getContributorCount(owner: string, repo: string): Promise<number> {
  try {
    const data = await fetchGitHubApi(`/repos/${owner}/${repo}/contributors?per_page=1`) as any[];
    if (data && data.length === 1 && data[0].total_count !== undefined) {
      return data[0].total_count;
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

export async function syncGitHubData(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  try {
    const today = getToday();
    console.log(`[${today}] Starting GitHub sync for org: ${GITHUB_ORG}`);

    const [mainOwner, mainRepo] = GITHUB_MAIN_REPO.split('/');
    const mainStats = await getMainRepoStats(mainOwner, mainRepo);
    const mainContributorCount = await getContributorCount(mainOwner, mainRepo);
    console.log(`Main repo ${GITHUB_MAIN_REPO}: stars=${mainStats.stars}, forks=${mainStats.forks}, contributors=${mainContributorCount}`);

    const allRepos = await getAllRepos(GITHUB_ORG);
    console.log(`Found ${allRepos.length} repositories`);

    const contributorsMap = new Map<string, ContributorInfo>();
    let reposScanned = 0;

    for (const repo of allRepos) {
      const repoName = repo.name.toLowerCase();
      if (EXCLUDED_REPOS.has(repoName)) {
        console.log(`Skipping excluded repo: ${repo.full_name}`);
        continue;
      }

      reposScanned++;
      console.log(`Processing: ${repo.full_name}`);

      const [commits, issues, prs] = await Promise.all([
        getRepoCommitsWithYear(GITHUB_ORG, repo.name),
        getRepoIssuesWithYear(GITHUB_ORG, repo.name),
        getRepoPRsWithYear(GITHUB_ORG, repo.name)
      ]);

      commits.forEach((years, login) => {
        const info = contributorsMap.get(login) || { login, years: new Set(), prContributions: 0, issueContributions: 0 };
        years.forEach(y => info.years.add(y));
        contributorsMap.set(login, info);
      });

      issues.forEach((years, login) => {
        const info = contributorsMap.get(login) || { login, years: new Set(), prContributions: 0, issueContributions: 0 };
        years.forEach(y => {
          info.years.add(y);
          info.issueContributions++;
        });
        contributorsMap.set(login, info);
      });

      prs.forEach((years, login) => {
        const info = contributorsMap.get(login) || { login, years: new Set(), prContributions: 0, issueContributions: 0 };
        years.forEach(y => {
          info.years.add(y);
          info.prContributions++;
        });
        contributorsMap.set(login, info);
      });
    }

    let contributors2024 = 0;
    let contributors2025 = 0;
    let contributors2026 = 0;

    contributorsMap.forEach((info) => {
      if (info.years.has(2024)) contributors2024++;
      if (info.years.has(2025)) contributors2025++;
      if (info.years.has(2026)) contributors2026++;
    });

    const totalContributors = contributorsMap.size;

    const githubStats = {
      date: today,
      stars: mainStats.stars,
      forks: mainStats.forks,
      watchers: mainStats.watchers,
      subscribers: mainStats.watchers,
      open_issues: mainStats.openIssues,
      open_prs: 0,
      contributors: mainContributorCount,
      releases_count: 0
    };

    saveGitHubStats(githubStats);

    saveContributorStats({
      date: today,
      total_contributors: totalContributors,
      contributors_before_2026: contributors2024 + contributors2025,
      new_contributors_daily: 0,
      new_contributors_weekly: 0,
      new_contributors_monthly: contributors2026,
      new_contributors_quarterly: contributors2026,
      cumulative_2026: totalContributors
    });

    console.log(`Sync complete:`);
    console.log(`  Total contributors (all time): ${totalContributors}`);
    console.log(`  2024 contributors: ${contributors2024}`);
    console.log(`  2025 contributors: ${contributors2025}`);
    console.log(`  2026 contributors: ${contributors2026}`);
    console.log(`  Repos scanned: ${reposScanned}`);

    return {
      success: true,
      data: {
        stars: mainStats.stars,
        forks: mainStats.forks,
        totalContributors,
        contributors2024,
        contributors2025,
        contributors2026,
        reposScanned,
        topContributors: Array.from(contributorsMap.entries())
          .map(([login, info]) => ({
            login,
            years: Array.from(info.years).sort(),
            totalContributions: info.prContributions + info.issueContributions
          }))
          .sort((a, b) => b.totalContributions - a.totalContributions)
          .slice(0, 10)
      }
    };
  } catch (error: any) {
    console.error('GitHub sync error:', error);
    return { success: false, error: error.message || 'Failed to sync GitHub data' };
  }
}
