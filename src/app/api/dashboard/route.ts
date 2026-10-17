import { NextResponse } from 'next/server';
import {
  getLatestGitHubStats,
  getGitHubStatsByDateRange,
  getGitHubStatsForDate,
  getLatestContributorStats,
  getContributorStatsByDateRange,
  getContributorStatsForDate,
  getLatestSocialStats,
  getSocialStatsForDate,
  getSocialStatsByDateRange,
  getLatestArticleStats,
  getArticleStatsForDate,
  getArticleStatsByDateRange,
  getEventsByDateRange,
  getEventsForDate,
  getDownloadStatsHistory
} from '@/lib/db';
import { createDataSlice, createPlatformFreshness, projectDataSlice, type DataSlice } from '@/lib/data-slices';
import { getDataRangeParams } from '@/lib/date-query';
import {
  toDashboardArticleSummary,
  toDashboardContributorSummary,
  selectDashboardContributor,
  toDashboardGitHubSummary,
  toDashboardSocialSummary,
  type DashboardRow,
} from '@/lib/dashboard-summary';

function projectFreshnessMap(
  values: Record<string, DataSlice<DashboardRow>>,
  project: (row: DashboardRow) => DashboardRow,
) {
  return Object.fromEntries(
    Object.entries(values).map(([platform, slice]) => [platform, projectDataSlice(slice, project)]),
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate, isSingleDay } = getDataRangeParams(
      searchParams,
      new Date().toISOString().split('T')[0],
    );
    const includeDownloads = searchParams.get('include')?.split(',').includes('downloads') || false;
    const includeContributors = searchParams.get('include')?.split(',').includes('contributors') || false;
    let githubData: {
      latest: Awaited<ReturnType<typeof getLatestGitHubStats>>;
      history: Awaited<ReturnType<typeof getGitHubStatsByDateRange>>;
      isArchive: boolean;
      archiveDate?: string | null;
    };
    let contributorData: {
      latest: Awaited<ReturnType<typeof getLatestContributorStats>>;
      history: Awaited<ReturnType<typeof getContributorStatsByDateRange>>;
      isArchive: boolean;
      archiveDate?: string | null;
    };
    let socialData: Awaited<ReturnType<typeof getLatestSocialStats>>;
    let articleData: Awaited<ReturnType<typeof getLatestArticleStats>>;
    let events: Awaited<ReturnType<typeof getEventsForDate>>;
    let freshness: Record<string, unknown>;

    if (isSingleDay) {
      const [
        githubForDate,
        contributorForDate,
        socialForDate,
        articleForDate,
        eventsForDate,
        githubLatest,
        contributorLatest,
        socialLatest,
        articleLatest
      ] = await Promise.all([
        getGitHubStatsForDate(startDate),
        getContributorStatsForDate(startDate),
        getSocialStatsForDate(startDate),
        getArticleStatsForDate(startDate),
        getEventsForDate(startDate),
        getLatestGitHubStats(endDate),
        getLatestContributorStats(endDate),
        getLatestSocialStats(endDate),
        getLatestArticleStats(endDate)
      ]);

      const githubSlice = createDataSlice(startDate, githubForDate, githubLatest);
      const contributorSlice = createDataSlice(startDate, contributorForDate, contributorLatest);

      githubData = {
        latest: githubSlice.data,
        history: githubSlice.data ? [githubSlice.data] : [],
        isArchive: !githubSlice.has_exact_data,
        archiveDate: githubSlice.data_date,
      };
      contributorData = {
        latest: contributorSlice.data,
        history: contributorSlice.data ? [contributorSlice.data] : [],
        isArchive: !contributorSlice.has_exact_data,
        archiveDate: contributorSlice.data_date,
      };
      const socialPlatforms = Array.from(new Set(socialLatest.map(row => row.platform)));
      const articlePlatforms = Array.from(new Set(articleLatest.map(row => row.platform)));
      const socialFreshness = createPlatformFreshness(socialPlatforms, startDate, socialForDate, socialLatest);
      const articleFreshness = createPlatformFreshness(articlePlatforms, startDate, articleForDate, articleLatest);
      socialData = Object.values(socialFreshness).flatMap(slice => slice.data ? [slice.data] : []);
      articleData = Object.values(articleFreshness).flatMap(slice => slice.data ? [slice.data] : []);
      events = eventsForDate;
      freshness = {
        github: githubSlice,
        contributors: contributorSlice,
        social: socialFreshness,
        articles: articleFreshness,
      };
    } else {
      const [
        githubLatest,
        githubHistory,
        contributorLatest,
        contributorHistory,
        socialStats,
        articleStats,
        eventsData
      ] = await Promise.all([
        getLatestGitHubStats(endDate),
        getGitHubStatsByDateRange(startDate, endDate),
        getLatestContributorStats(endDate),
        getContributorStatsByDateRange(startDate, endDate),
        getSocialStatsByDateRange(startDate, endDate),
        getArticleStatsByDateRange(startDate, endDate),
        getEventsByDateRange(startDate, endDate, 20)
      ]);

      githubData = {
        latest: githubLatest,
        history: githubHistory,
        isArchive: false
      };
      contributorData = {
        latest: contributorLatest,
        history: contributorHistory,
        isArchive: false
      };
      socialData = socialStats;
      articleData = articleStats;
      events = eventsData;
      const [socialLatest, articleLatest] = await Promise.all([
        getLatestSocialStats(endDate),
        getLatestArticleStats(endDate),
      ]);
      freshness = {
        github: createDataSlice(undefined, githubHistory.at(-1) || null, githubLatest),
        contributors: createDataSlice(undefined, contributorHistory.at(-1) || null, contributorLatest),
        social: createPlatformFreshness(
          Array.from(new Set(socialLatest.map(row => row.platform))),
          undefined,
          socialStats,
          socialLatest,
        ),
        articles: createPlatformFreshness(
          Array.from(new Set(articleLatest.map(row => row.platform))),
          undefined,
          articleStats,
          articleLatest,
        ),
      };
    }

    const downloadHistory = includeDownloads ? await getDownloadStatsHistory(365) : [];

    const typedFreshness = freshness as {
      github: DataSlice<DashboardRow>;
      contributors: DataSlice<DashboardRow>;
      social: Record<string, DataSlice<DashboardRow>>;
      articles: Record<string, DataSlice<DashboardRow>>;
    };

    const response: Record<string, unknown> = {
      github: {
        ...githubData,
        latest: toDashboardGitHubSummary(githubData.latest ? { ...githubData.latest } : null),
        history: githubData.history.map(row => toDashboardGitHubSummary({ ...row })),
      },
      contributors: {
        ...contributorData,
        latest: selectDashboardContributor(contributorData.latest ? { ...contributorData.latest } : null, includeContributors),
        history: contributorData.history.map(row => toDashboardContributorSummary({ ...row })),
      },
      social: socialData.map(row => toDashboardSocialSummary({ ...row })),
      articles: articleData.map(row => toDashboardArticleSummary({ ...row })),
      events: events,
      freshness: {
        github: projectDataSlice(typedFreshness.github, row => toDashboardGitHubSummary(row) || {}),
        contributors: projectDataSlice(typedFreshness.contributors, row => toDashboardContributorSummary(row) || {}),
        social: projectFreshnessMap(typedFreshness.social, toDashboardSocialSummary),
        articles: projectFreshnessMap(typedFreshness.articles, toDashboardArticleSummary),
      },
    };
    if (includeDownloads) response.downloads = downloadHistory;

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
