export interface ContributorActivityItem {
  number: number;
  type: 'issue' | 'pr';
  author: string;
  created_at: string;
}

export interface MainRepoContributor {
  login: string;
  issue_count: number;
  pr_count: number;
  total: number;
}

export interface MainRepoContributorStats {
  issue_count: number;
  pr_count: number;
  unique_creators: number;
  issue_creators: number;
  pr_creators: number;
  top_contributors: MainRepoContributor[];
}

export function aggregateContributorActivity(
  items: ContributorActivityItem[],
  since: string,
  until: string = '9999-12-31',
): MainRepoContributorStats {
  const seen = new Set<string>();
  const contributors = new Map<string, { issue_count: number; pr_count: number }>();
  let issueCount = 0;
  let prCount = 0;

  for (const item of items) {
    const createdDate = item.created_at.slice(0, 10);
    if (createdDate < since || createdDate > until) continue;

    const itemKey = `${item.type}:${item.number}`;
    if (seen.has(itemKey) || !item.author) continue;
    seen.add(itemKey);

    const counts = contributors.get(item.author) || { issue_count: 0, pr_count: 0 };
    if (item.type === 'issue') {
      issueCount++;
      counts.issue_count++;
    } else {
      prCount++;
      counts.pr_count++;
    }
    contributors.set(item.author, counts);
  }

  const topContributors = Array.from(contributors, ([login, counts]) => ({
    login,
    ...counts,
    total: counts.issue_count + counts.pr_count,
  }))
    .sort((a, b) => b.total - a.total || a.login.localeCompare(b.login))
    .slice(0, 10);

  return {
    issue_count: issueCount,
    pr_count: prCount,
    unique_creators: contributors.size,
    issue_creators: Array.from(contributors.values()).filter(counts => counts.issue_count > 0).length,
    pr_creators: Array.from(contributors.values()).filter(counts => counts.pr_count > 0).length,
    top_contributors: topContributors,
  };
}
