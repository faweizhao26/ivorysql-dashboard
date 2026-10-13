export type DashboardRow = Record<string, unknown>;

export function selectDashboardContributor(row: DashboardRow | null, includeDetails: boolean): DashboardRow | null {
  return includeDetails ? row : toDashboardContributorSummary(row);
}

export function toDashboardGitHubSummary(row: DashboardRow | null): DashboardRow | null {
  if (!row) return null;
  return {
    date: row.date,
    stars: row.stars,
    forks: row.forks,
    watchers: row.watchers,
    open_issues: row.open_issues,
    open_prs: row.open_prs,
    contributors: row.contributors,
    releases_count: row.releases_count,
  };
}

export function toDashboardContributorSummary(row: DashboardRow | null): DashboardRow | null {
  if (!row) return null;
  return {
    date: row.date,
    total_contributors: row.total_contributors,
    contributors_before_2026: row.contributors_before_2026,
    cumulative_2026: row.cumulative_2026,
    new_contributors_daily: row.new_contributors_daily,
    new_contributors_monthly: row.new_contributors_monthly,
    main_repo_code_contributors: row.main_repo_code_contributors,
  };
}

export function toDashboardSocialSummary(row: DashboardRow): DashboardRow {
  return {
    date: row.date,
    platform: row.platform,
    followers: row.followers,
    views: row.views,
  };
}

export function toDashboardArticleSummary(row: DashboardRow): DashboardRow {
  return {
    date: row.date,
    platform: row.platform,
    article_count: row.article_count,
    total_views: row.total_views,
  };
}
