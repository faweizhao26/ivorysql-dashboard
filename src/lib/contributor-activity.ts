import { getBeijingDate } from './date';

export type ContributorStatus = 'open' | 'closed' | 'merged';

export interface ContributorActivityItem {
  number: number;
  type: 'issue' | 'pr';
  author: string;
  created_at: string;
  merged_at?: string;
  status: ContributorStatus;
  title?: string;
  url?: string;
}

export interface MainRepoContributor {
  login: string;
  issue_count: number;
  pr_count: number;
  merged_pr_count: number;
  unmerged_pr_count: number;
  total: number;
}

export interface MainRepoContributorStats {
  issue_count: number;
  pr_count: number;
  unique_creators: number;
  issue_creators: number;
  pr_creators: number;
  merged_pr_count: number;
  unmerged_pr_count: number;
  merged_pr_creators: number;
  unmerged_pr_creators: number;
  top_contributors: MainRepoContributor[];
}

export interface MainRepoMonthlyActivity {
  month: string;
  contributor_count: number;
  year_first_contributor_count: number;
  new_contributor_count: number;
  issue_count: number;
  pr_count: number;
  merged_pr_count: number;
  unmerged_pr_count: number;
  year_first_contributors: string[];
  new_contributors: string[];
  contributors: MainRepoContributor[];
  contributions: ContributorActivityItem[];
}

export function isCurrentContributionMonth(month: string, today: Date = new Date()): boolean {
  return month === getBeijingDate(today).slice(0, 7);
}

export function aggregateContributorActivity(
  items: ContributorActivityItem[],
  since: string,
  until: string = '9999-12-31',
): MainRepoContributorStats {
  const seen = new Set<string>();
  const contributors = new Map<string, { issue_count: number; pr_count: number; merged_pr_count: number; unmerged_pr_count: number }>();
  const prStatuses = new Map<string, { merged: boolean; unmerged: boolean }>();
  let issueCount = 0;
  let prCount = 0;
  let mergedPrCount = 0;
  let unmergedPrCount = 0;

  for (const item of items) {
    const createdDate = item.created_at.slice(0, 10);
    if (createdDate < since || createdDate > until) continue;

    const itemKey = `${item.type}:${item.number}`;
    if (seen.has(itemKey) || !item.author) continue;
    seen.add(itemKey);

    const counts = contributors.get(item.author) || { issue_count: 0, pr_count: 0, merged_pr_count: 0, unmerged_pr_count: 0 };
    if (item.type === 'issue') {
      issueCount++;
      counts.issue_count++;
    } else {
      prCount++;
      counts.pr_count++;
      const status = prStatuses.get(item.author) || { merged: false, unmerged: false };
      if (item.status === 'merged') {
        mergedPrCount++;
        counts.merged_pr_count++;
        status.merged = true;
      } else {
        unmergedPrCount++;
        counts.unmerged_pr_count++;
        status.unmerged = true;
      }
      prStatuses.set(item.author, status);
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
    merged_pr_count: mergedPrCount,
    unmerged_pr_count: unmergedPrCount,
    merged_pr_creators: Array.from(prStatuses.values()).filter(status => status.merged).length,
    unmerged_pr_creators: Array.from(prStatuses.values()).filter(status => status.unmerged).length,
    top_contributors: topContributors,
  };
}

export function aggregateMonthlyContributorActivity(
  items: ContributorActivityItem[],
  year: number,
): MainRepoMonthlyActivity[] {
  const seenItems = new Set<string>();
  const uniqueItems = [...items]
    .filter(item => item.author && item.created_at)
    .sort((a, b) => getMonthlyActivityDate(a).localeCompare(getMonthlyActivityDate(b)))
    .filter((item) => {
      const itemKey = `${item.type}:${item.number}`;
      if (seenItems.has(itemKey)) return false;
      seenItems.add(itemKey);
      return true;
    });
  const firstSeen = new Map<string, string>();
  const firstSeenInYear = new Map<string, string>();

  for (const item of uniqueItems) {
    const contributionDate = getValidContributionDate(item);
    if (!contributionDate) continue;
    const previousDate = firstSeen.get(item.author);
    if (!previousDate || contributionDate < previousDate) firstSeen.set(item.author, contributionDate);
    if (new Date(`${contributionDate}T00:00:00Z`).getUTCFullYear() === year) {
      const previousYearDate = firstSeenInYear.get(item.author);
      if (!previousYearDate || contributionDate < previousYearDate) firstSeenInYear.set(item.author, contributionDate);
    }
  }

  const monthly = new Map<string, {
    counts: Map<string, { issue_count: number; pr_count: number; merged_pr_count: number; unmerged_pr_count: number }>;
    validContributors: Set<string>;
    contributions: ContributorActivityItem[];
    issue_count: number;
    pr_count: number;
    merged_pr_count: number;
    unmerged_pr_count: number;
  }>();

  for (const item of uniqueItems) {
    const activityDate = getMonthlyActivityDate(item);
    if (new Date(`${activityDate}T00:00:00Z`).getUTCFullYear() !== year) continue;

    const month = activityDate.slice(0, 7);
    const current = monthly.get(month) || {
      counts: new Map(),
      validContributors: new Set<string>(),
      contributions: [] as ContributorActivityItem[],
      issue_count: 0,
      pr_count: 0,
      merged_pr_count: 0,
      unmerged_pr_count: 0,
    };
    const contributor = current.counts.get(item.author) || { issue_count: 0, pr_count: 0, merged_pr_count: 0, unmerged_pr_count: 0 };
    if (item.type === 'issue') {
      contributor.issue_count++;
      current.issue_count++;
      current.validContributors.add(item.author);
    } else {
      contributor.pr_count++;
      current.pr_count++;
      if (item.status === 'merged') {
        contributor.merged_pr_count++;
        current.merged_pr_count++;
        current.validContributors.add(item.author);
      } else {
        contributor.unmerged_pr_count++;
        current.unmerged_pr_count++;
      }
    }
    current.counts.set(item.author, contributor);
    current.contributions.push(item);
    monthly.set(month, current);
  }

  return Array.from(monthly, ([month, data]) => {
    const contributors = Array.from(data.counts, ([login, counts]) => ({
      login,
      ...counts,
      total: counts.issue_count + counts.pr_count,
    }))
      .filter(contributor => data.validContributors.has(contributor.login))
      .sort((a, b) => b.total - a.total || a.login.localeCompare(b.login));
    const yearFirstContributors = contributors
      .filter(contributor => firstSeenInYear.get(contributor.login)?.slice(0, 7) === month)
      .map(contributor => contributor.login)
      .sort();
    const newContributors = contributors
      .filter(contributor => firstSeen.get(contributor.login)?.slice(0, 7) === month)
      .map(contributor => contributor.login)
      .sort();

    return {
      month,
      contributor_count: data.validContributors.size,
      year_first_contributor_count: yearFirstContributors.length,
      new_contributor_count: newContributors.length,
      issue_count: data.issue_count,
      pr_count: data.pr_count,
      merged_pr_count: data.merged_pr_count,
      unmerged_pr_count: data.unmerged_pr_count,
      year_first_contributors: yearFirstContributors,
      new_contributors: newContributors,
      contributors,
      contributions: data.contributions,
    };
  }).sort((a, b) => a.month.localeCompare(b.month));
}

export function aggregateContributorSummary(
  items: ContributorActivityItem[],
  since: string,
  until: string,
  year: number,
) {
  const firstSeen = new Map<string, string>();
  for (const item of items) {
    if (!item.author || item.created_at.slice(0, 10) < since) continue;
    // Unlike legacy monthly display data, a summary needs the actual merge date.
    if (item.type === 'pr' && item.status === 'merged' && !item.merged_at) {
      throw new Error(`Missing merge date for PR #${item.number}`);
    }
    const date = getValidContributionDate(item);
    if (!date || date > until) continue;
    const previous = firstSeen.get(item.author);
    if (!previous || date < previous) firstSeen.set(item.author, date);
  }

  const firstDates = Array.from(firstSeen.values());
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  // Rolling UTC windows include the snapshot day: 1, 7, 30 and 90 days.
  const countNew = (days: number) => {
    const start = new Date(`${until}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const startDate = start.toISOString().slice(0, 10);
    return firstDates.filter(date => date >= startDate).length;
  };

  return {
    contributors_before_2026: firstDates.filter(date => date < yearStart).length,
    new_contributors_daily: countNew(1),
    new_contributors_weekly: countNew(7),
    new_contributors_monthly: countNew(30),
    new_contributors_quarterly: countNew(90),
    cumulative_2026: firstDates.filter(date => date >= yearStart && date <= yearEnd).length,
  };
}

function getValidContributionDate(item: ContributorActivityItem): string | null {
  if (item.type === 'issue') return item.created_at.slice(0, 10);
  if (item.status === 'merged') return (item.merged_at || item.created_at).slice(0, 10);
  return null;
}

function getMonthlyActivityDate(item: ContributorActivityItem): string {
  return getValidContributionDate(item) || item.created_at.slice(0, 10);
}
