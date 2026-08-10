import { Octokit } from '@octokit/rest';
import { getToday, saveCommunityEvent } from './db';
import { getMainRepoMetrics, syncGitHubData } from './github-sync';

const OWNER = 'IvorySQL';
const REPO = 'IvorySQL';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function getOctokit(): Octokit {
  return new Octokit({ auth: GITHUB_TOKEN });
}

export async function fetchGitHubRepoData() {
  const metrics = await getMainRepoMetrics();
  return {
    stars: metrics.stars,
    forks: metrics.forks,
    watchers: metrics.watchers,
    subscribers: metrics.subscribers,
    open_issues: metrics.open_issues,
    open_prs: metrics.open_prs,
    releases_count: metrics.releases_count,
  };
}

export async function fetchLatestEvents(): Promise<Array<{
  date: string;
  source: string;
  title: string;
  description: string;
  url: string;
  event_type: string;
}>> {
  const octokit = getOctokit();

  const [issues, prs, releases] = await Promise.all([
    octokit.issues.list({ owner: OWNER, repo: REPO, state: 'all', per_page: 10, sort: 'updated' }),
    octokit.pulls.list({ owner: OWNER, repo: REPO, state: 'all', per_page: 10, sort: 'updated' }),
    octokit.repos.listReleases({ owner: OWNER, repo: REPO, per_page: 5 }),
  ]);

  const events = [
    ...issues.data.filter(issue => !issue.pull_request).map(issue => ({
      date: issue.updated_at?.split('T')[0] || getToday(),
      source: 'GitHub Issue',
      title: `#${issue.number}: ${issue.title}`,
      description: issue.body?.substring(0, 200) || '',
      url: issue.html_url,
      event_type: 'github_issue',
    })),
    ...prs.data.map(pr => ({
      date: pr.updated_at?.split('T')[0] || getToday(),
      source: 'GitHub PR',
      title: `#${pr.number}: ${pr.title}`,
      description: `${pr.user?.login || 'unknown'} opened a pull request`,
      url: pr.html_url,
      event_type: 'github_pr',
    })),
    ...releases.data.map(release => ({
      date: release.published_at?.split('T')[0] || getToday(),
      source: 'GitHub Release',
      title: release.name || release.tag_name,
      description: release.body?.substring(0, 200) || '',
      url: release.html_url,
      event_type: 'release',
    })),
  ];

  return events
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);
}

export async function updateAllGitHubData(): Promise<void> {
  const result = await syncGitHubData();
  if (!result.success) {
    throw new Error(result.error || 'Failed to sync GitHub data');
  }

  const events = await fetchLatestEvents();
  await Promise.all(events.map(event => saveCommunityEvent(event)));
  console.log(`Saved GitHub data and ${events.length} community events`);
}

if (require.main === module) {
  updateAllGitHubData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
