export interface ContributorActivityItem {
  number: number;
  type: 'issue' | 'pr';
  author: string;
  created_at: string;
  title?: string;
  url?: string;
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

export interface MainRepoMonthlyActivity {
  month: string;
  contributor_count: number;
  new_contributor_count: number;
  issue_count: number;
  pr_count: number;
  new_contributors: string[];
  contributors: MainRepoContributor[];
  contributions: ContributorActivityItem[];
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

export function aggregateMonthlyContributorActivity(
  items: ContributorActivityItem[],
  year: number,
): MainRepoMonthlyActivity[] {
  const seenItems = new Set<string>();
  const sortedItems = [...items]
    .filter(item => item.author && item.created_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const firstSeen = new Map<string, string>();

  for (const item of sortedItems) {
    const itemKey = `${item.type}:${item.number}`;
    if (seenItems.has(itemKey)) continue;
    seenItems.add(itemKey);
    if (!firstSeen.has(item.author)) {
      firstSeen.set(item.author, item.created_at.slice(0, 10));
    }
  }

  const monthly = new Map<string, {
    counts: Map<string, { issue_count: number; pr_count: number }>;
    contributions: ContributorActivityItem[];
    newContributors: string[];
    issue_count: number;
    pr_count: number;
  }>();

  for (const item of sortedItems) {
    const itemKey = `${item.type}:${item.number}`;
    if (!seenItems.has(itemKey)) continue;
    seenItems.delete(itemKey);

    const createdDate = item.created_at.slice(0, 10);
    if (new Date(`${createdDate}T00:00:00Z`).getUTCFullYear() !== year) continue;

    const month = createdDate.slice(0, 7);
    const current = monthly.get(month) || {
      counts: new Map(),
      contributions: [] as ContributorActivityItem[],
      newContributors: [] as string[],
      issue_count: 0,
      pr_count: 0,
    };
    const contributor = current.counts.get(item.author) || { issue_count: 0, pr_count: 0 };
    if (item.type === 'issue') {
      contributor.issue_count++;
      current.issue_count++;
    } else {
      contributor.pr_count++;
      current.pr_count++;
    }
    current.counts.set(item.author, contributor);
    current.contributions.push(item);

    const firstDate = firstSeen.get(item.author);
    if (firstDate?.slice(0, 7) === month && !current.newContributors.includes(item.author)) {
      current.newContributors.push(item.author);
    }
    monthly.set(month, current);
  }

  return Array.from(monthly, ([month, data]) => ({
    month,
    contributor_count: data.counts.size,
    new_contributor_count: data.newContributors.length,
    issue_count: data.issue_count,
    pr_count: data.pr_count,
    new_contributors: data.newContributors.sort(),
    contributors: Array.from(data.counts, ([login, counts]) => ({
      login,
      ...counts,
      total: counts.issue_count + counts.pr_count,
    })).sort((a, b) => b.total - a.total || a.login.localeCompare(b.login)),
    contributions: data.contributions,
  })).sort((a, b) => a.month.localeCompare(b.month));
}
