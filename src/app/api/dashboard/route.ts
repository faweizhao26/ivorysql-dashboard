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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const startDateParam = searchParams.get('start');
  const isSingleDay = startDateParam === endDate && startDateParam !== null;
  
  let startDate: string;
  if (startDateParam) {
    startDate = startDateParam;
  } else {
    const days = parseInt(searchParams.get('days') || '30', 10);
    const d = new Date();
    d.setDate(d.getDate() - days);
    startDate = d.toISOString().split('T')[0];
  }

  try {
    let githubData: any;
    let contributorData: any;
    let socialData: any[];
    let articleData: any[];
    let events: any[];

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
        getLatestGitHubStats(),
        getLatestContributorStats(),
        getLatestSocialStats(),
        getLatestArticleStats()
      ]);

      const hasDataForDate = githubForDate || contributorForDate || socialForDate.length > 0;

      githubData = {
        latest: githubForDate || githubLatest,
        history: githubForDate ? [githubForDate] : (githubLatest ? [githubLatest] : []),
        isArchive: !hasDataForDate,
        archiveDate: hasDataForDate ? startDate : (githubLatest?.date || null)
      };
      contributorData = {
        latest: contributorForDate || contributorLatest,
        history: contributorForDate ? [contributorForDate] : (contributorLatest ? [contributorLatest] : []),
        isArchive: !hasDataForDate,
        archiveDate: hasDataForDate ? startDate : (contributorLatest?.date || null)
      };
      socialData = socialForDate.length > 0 ? socialForDate : socialLatest;
      articleData = articleForDate.length > 0 ? articleForDate : articleLatest;
      events = eventsForDate;
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
        getLatestGitHubStats(),
        getGitHubStatsByDateRange(startDate, endDate),
        getLatestContributorStats(),
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
    }

    const [downloadHistory] = await Promise.all([
      getDownloadStatsHistory(365)
    ]);

    const response: Record<string, any> = {
      github: githubData,
      contributors: contributorData,
      social: socialData,
      articles: articleData,
      events: events,
      downloads: downloadHistory || []
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
