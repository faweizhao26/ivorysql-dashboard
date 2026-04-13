import { Octokit } from '@octokit/rest';
import {
  saveGitHubStats,
  saveContributorStats,
  saveCommunityEvent,
  getToday,
  GitHubStats,
  CommunityEvent
} from './db';

const OWNER = 'IvorySQL';
const REPO = 'IvorySQL';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function getOctokit(): Octokit {
  return new Octokit({ auth: GITHUB_TOKEN });
}

interface ContributorInfo {
  login: string;
  first_appearance: string;
  type: 'issue' | 'pr' | 'both';
}

interface ContributorStats {
  total_before_2026: number;
  daily_2026: Record<string, number>;
  weekly_2026: Record<string, number>;
  monthly_2026: Record<string, number>;
  quarterly_2026: Record<string, number>;
  cumulative_2026: Record<string, number>;
}

async function fetchAllIssues(): Promise<any[]> {
  const octokit = getOctokit();
  const issues: any[] = [];
  
  try {
    let page = 1;
    const perPage = 100;
    const maxPages = 50;
    
    for (let i = 0; i < maxPages; i++) {
      const response = await octokit.issues.listForRepo({
        owner: OWNER,
        repo: REPO,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: perPage,
        page: page
      });
      
      const filteredIssues = response.data.filter((i: any) => !i.pull_request);
      issues.push(...filteredIssues);
      
      if (response.data.length < perPage || issues.length >= 5000) break;
      page++;
    }
  } catch (error) {
    console.error('Error fetching issues:', error);
  }
  
  return issues;
}

async function fetchAllPRs(): Promise<any[]> {
  const octokit = getOctokit();
  const prs: any[] = [];
  
  try {
    let page = 1;
    const perPage = 100;
    const maxPages = 50;
    
    for (let i = 0; i < maxPages; i++) {
      const response = await octokit.pulls.list({
        owner: OWNER,
        repo: REPO,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: perPage,
        page: page
      });
      
      prs.push(...response.data);
      if (response.data.length < perPage || prs.length >= 5000) break;
      page++;
    }
  } catch (error) {
    console.error('Error fetching PRs:', error);
  }
  
  return prs;
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getQuarterKey(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

export async function analyzeContributors(): Promise<ContributorStats> {
  const [issues, prs] = await Promise.all([fetchAllIssues(), fetchAllPRs()]);
  
  const contributorMap = new Map<string, ContributorInfo>();
  const cutoff2026 = new Date('2026-01-01');
  
  issues.forEach(issue => {
    if (!issue.user?.login) return;
    const login = issue.user.login;
    const createdAt = new Date(issue.created_at);
    
    if (contributorMap.has(login)) {
      const existing = contributorMap.get(login)!;
      if (createdAt < new Date(existing.first_appearance)) {
        existing.first_appearance = issue.created_at.split('T')[0];
      }
      if (existing.type === 'pr') existing.type = 'both';
    } else {
      contributorMap.set(login, {
        login,
        first_appearance: issue.created_at.split('T')[0],
        type: 'issue'
      });
    }
  });
  
  prs.forEach(pr => {
    if (!pr.user?.login) return;
    const login = pr.user.login;
    const createdAt = new Date(pr.created_at);
    
    if (contributorMap.has(login)) {
      const existing = contributorMap.get(login)!;
      if (createdAt < new Date(existing.first_appearance)) {
        existing.first_appearance = pr.created_at.split('T')[0];
      }
      if (existing.type === 'issue') existing.type = 'both';
    } else {
      contributorMap.set(login, {
        login,
        first_appearance: pr.created_at.split('T')[0],
        type: 'pr'
      });
    }
  });
  
  let totalBefore2026 = 0;
  const daily2026: Record<string, number> = {};
  const weekly2026: Record<string, number> = {};
  const monthly2026: Record<string, number> = {};
  const quarterly2026: Record<string, number> = {};
  
  contributorMap.forEach((info) => {
    const firstDate = new Date(info.first_appearance);
    
    if (firstDate < cutoff2026) {
      totalBefore2026++;
    } else {
      const dateKey = info.first_appearance;
      const weekKey = getWeekKey(firstDate);
      const monthKey = getMonthKey(firstDate);
      const quarterKey = getQuarterKey(firstDate);
      
      daily2026[dateKey] = (daily2026[dateKey] || 0) + 1;
      weekly2026[weekKey] = (weekly2026[weekKey] || 0) + 1;
      monthly2026[monthKey] = (monthly2026[monthKey] || 0) + 1;
      quarterly2026[quarterKey] = (quarterly2026[quarterKey] || 0) + 1;
    }
  });
  
  const sortedDays = Object.keys(daily2026).sort();
  let cumulative = totalBefore2026;
  const cumulative2026: Record<string, number> = {};
  sortedDays.forEach(day => {
    cumulative += daily2026[day];
    cumulative2026[day] = cumulative;
  });
  
  return {
    total_before_2026: totalBefore2026,
    daily_2026: daily2026,
    weekly_2026: weekly2026,
    monthly_2026: monthly2026,
    quarterly_2026: quarterly2026,
    cumulative_2026: cumulative2026
  };
}

export async function fetchGitHubRepoData(): Promise<{
  stars: number;
  forks: number;
  watchers: number;
  subscribers: number;
  open_issues: number;
  open_prs: number;
  releases_count: number;
} | null> {
  const octokit = getOctokit();
  
  try {
    const [repo, prs] = await Promise.all([
      octokit.repos.get({ owner: OWNER, repo: REPO }),
      octokit.pulls.list({ owner: OWNER, repo: REPO, state: 'open', per_page: 100 })
    ]);
    
    return {
      stars: repo.data.stargazers_count,
      forks: repo.data.forks_count,
      watchers: repo.data.watchers_count,
      subscribers: repo.data.subscribers_count,
      open_issues: repo.data.open_issues_count,
      open_prs: prs.data.length,
      releases_count: 0
    };
  } catch (error) {
    console.error('Error fetching repo data:', error);
    return null;
  }
}

export async function fetchLatestEvents(): Promise<any[]> {
  const octokit = getOctokit();
  
  try {
    const [issues, prs, releases] = await Promise.all([
      octokit.issues.list({
        owner: OWNER,
        repo: REPO,
        state: 'all',
        per_page: 10,
        sort: 'updated'
      }),
      octokit.pulls.list({
        owner: OWNER,
        repo: REPO,
        state: 'all',
        per_page: 10,
        sort: 'updated'
      }),
      octokit.repos.listReleases({
        owner: OWNER,
        repo: REPO,
        per_page: 5
      })
    ]);
    
    const events: any[] = [];
    
    issues.data.filter(i => !i.pull_request).forEach(issue => {
      events.push({
        date: issue.updated_at?.split('T')[0] || getToday(),
        source: 'GitHub Issue',
        title: `#${issue.number}: ${issue.title}`,
        description: issue.body?.substring(0, 200) || '',
        url: issue.html_url,
        event_type: 'github_issue'
      });
    });
    
    prs.data.forEach(pr => {
      events.push({
        date: pr.updated_at?.split('T')[0] || getToday(),
        source: 'GitHub PR',
        title: `#${pr.number}: ${pr.title}`,
        description: `${pr.user?.login} opened a pull request`,
        url: pr.html_url,
        event_type: 'github_pr'
      });
    });
    
    releases.data.forEach(release => {
      events.push({
        date: release.published_at?.split('T')[0] || getToday(),
        source: 'GitHub Release',
        title: release.name || release.tag_name,
        description: release.body?.substring(0, 200) || '',
        url: release.html_url,
        event_type: 'release'
      });
    });
    
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export async function updateAllGitHubData(): Promise<void> {
  console.log('Starting GitHub data update...');
  
  const repoData = await fetchGitHubRepoData();
  if (!repoData) {
    console.error('Failed to fetch repo data');
    return;
  }
  
  console.log('Analyzing contributors...');
  const contributorStats = await analyzeContributors();
  
  const today = getToday();
  const stats: GitHubStats = {
    date: today,
    stars: repoData.stars,
    forks: repoData.forks,
    watchers: repoData.watchers,
    subscribers: repoData.subscribers,
    open_issues: repoData.open_issues,
    open_prs: repoData.open_prs,
    contributors: contributorStats.total_before_2026 + (Object.values(contributorStats.cumulative_2026).pop() ?? 0),
    releases_count: repoData.releases_count
  };
  
  const cumulative2026 = Object.values(contributorStats.cumulative_2026).pop() ?? 0;
  
  saveGitHubStats(stats);
  console.log(`Saved GitHub stats: Stars=${stats.stars}, Contributors=${stats.contributors}`);
  console.log(`  - Contributors before 2026: ${contributorStats.total_before_2026}`);
  console.log(`  - Contributors in 2026 (cumulative): ${cumulative2026}`);
  
  const todayObj = new Date(today);
  const weekKey = getWeekKey(todayObj);
  const monthKey = getMonthKey(todayObj);
  const quarterKey = getQuarterKey(todayObj);
  
  saveContributorStats({
    date: today,
    total_contributors: contributorStats.total_before_2026 + cumulative2026,
    contributors_before_2026: contributorStats.total_before_2026,
    new_contributors_daily: contributorStats.daily_2026[today] || 0,
    new_contributors_weekly: contributorStats.weekly_2026[weekKey] || 0,
    new_contributors_monthly: contributorStats.monthly_2026[monthKey] || 0,
    new_contributors_quarterly: contributorStats.quarterly_2026[quarterKey] || 0,
    cumulative_2026: cumulative2026
  });
  
  const events = await fetchLatestEvents();
  events.forEach(event => {
    saveCommunityEvent({
      date: event.date,
      source: event.source,
      title: event.title,
      description: event.description,
      url: event.url,
      event_type: event.event_type
    });
  });
  console.log(`Saved ${events.length} community events`);
  
  console.log('GitHub data update completed!');
}

if (require.main === module) {
  updateAllGitHubData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
