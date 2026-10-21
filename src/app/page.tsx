'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { getBeijingDate } from '@/lib/date';
import { fetchMetricPeriods, metricChange } from '@/lib/metric-periods';
import { ComparisonStatCard, PlatformCard } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { TrendChart } from '@/components/Charts';
import { ActivityTimeline } from '@/components/Timeline';
import { downloadCSV } from '@/lib/csv-utils';
import LastUpdated from '@/components/LastUpdated';
import { formatFreshnessLabel, getLatestUpdatedAt, type DataSlice } from '@/lib/data-slices';
import { ContentPlatformCards } from '@/components/ContentPlatformCards';
import { useContentOverview } from '@/lib/use-content-overview';
import { contentDateQuery, contentOverviewExportRows, type ContentOverview } from '@/lib/content-overview';
import type { ArticleDateRange } from '@/lib/article-query';

type FreshnessMap = Record<string, DataSlice<unknown>>;

interface DashboardData {
  github: {
    latest: {
      stars: number;
      forks: number;
      watchers: number;
      open_issues: number;
      open_prs: number;
      contributors: number;
      releases_count: number;
    } | null;
    history: Array<{
      date: string;
      stars: number;
      forks: number;
      contributors: number;
    }>;
  };
  contributors: {
    latest: {
      total_contributors: number;
      contributors_before_2026: number;
      cumulative_2026: number;
      new_contributors_monthly: number;
      main_repo_code_contributors?: number;
    } | null;
    history: Array<{
      date: string;
      cumulative_2026: number;
      new_contributors_daily: number;
    }>;
  };
  social: Array<{
    platform: string;
    followers: number;
    views: number;
  }>;
  articles: Array<{
    platform: string;
    article_count: number;
    total_views: number;
  }>;
  events: Array<{
    date: string;
    source: string;
    title: string;
    description: string;
    url: string;
    event_type: string;
  }>;
  downloads?: Array<{
    date: string;
    github_total: number;
    docker_total: number;
  }>;
  freshness: {
    github: DataSlice<unknown>;
    contributors: DataSlice<unknown>;
    social: FreshnessMap;
    articles: FreshnessMap;
  };
}

const socialPlatforms: Record<string, { name: string }> = {
  wechat: { name: '公众号' },
  shipinhao: { name: '视频号' },
  twitter: { name: 'Twitter' },
  bilibili: { name: 'B站' },
  youtube: { name: 'YouTube' },
};

export default function HomePage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = getBeijingDate();
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const { overview: contentOverview, loading: contentLoading, error: contentError, refresh: refreshContent } = useContentOverview(dateRange);
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<DashboardData | null>(null);
  const [previous, setPrevious] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const isSingleDay = dateRange.start === dateRange.end;

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setError(null);
      setPrevious(null);
      setComparisonError(null);
      try {
        const result = await fetchMetricPeriods<DashboardData>('/api/dashboard', dateRange,
          comparison?.enabled ? comparison.customRange : undefined, controller.signal);
        if (controller.signal.aborted) return;
        setData(result.current);
        setPrevious(result.previous);
        setComparisonError(result.comparisonError);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '数据加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchData();
    return () => controller.abort();
  }, [dateRange, comparison]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const visible = loading || error ? null : data;
  const github = visible?.github;
  const contributors = visible?.contributors;
  const social = visible?.social || [];
  const events = visible?.events || [];

  const githubHistory = github?.history || [];
  const contributorHistory = contributors?.history || [];

  const latestGitHub = github?.latest;
  const displayDate = isSingleDay ? dateRange.start : null;
  const freshnessSlices = visible?.freshness
    ? [
        visible.freshness.github,
        visible.freshness.contributors,
        ...Object.values(visible.freshness.social),
        ...Object.values(visible.freshness.articles),
      ]
    : [];
  const lastUpdated = getLatestUpdatedAt(freshnessSlices);

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  let comparePeriod = '';
  if (comparison?.enabled && comparison.customRange) {
    comparePeriod = `${comparison.customRange.start} ~ ${comparison.customRange.end}`;
  }

  const socialData = social.reduce((acc, item) => {
    acc[item.platform] = item;
    return acc;
  }, {} as Record<string, { followers: number; views: number }>);

  const previousSocial = Object.fromEntries((previous?.social || []).map(item => [item.platform, item]));
  const previousGitHub = previous?.github.latest;
  const previousContributors = previous?.contributors.latest?.main_repo_code_contributors ?? previousGitHub?.contributors;
  const currentContributors = contributors?.latest?.main_repo_code_contributors ?? latestGitHub?.contributors;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/10 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">IvorySQL 社区数据中心</h1>
            <p className="text-slate-400 text-sm max-w-md">追踪 GitHub、社交媒体、内容平台的运营数据，助力社区增长决策。</p>
            <p className="mt-2 text-xs text-slate-500"><LastUpdated value={lastUpdated} /></p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {displayDate && (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30 hidden sm:inline-flex">
                {displayDate}
              </span>
            )}
            <button
              disabled={loading || Boolean(error) || !data || contentLoading || Boolean(contentError)}
              onClick={() => exportDashboardData(visible, currentPeriod, contentOverview, dateRange)}
              className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors hidden md:block"
            >
              导出 CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <TimeRangeSelector onRangeChange={(range) => {
          setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
          setComparison(range.comparison);
        }} />
      </div>

      <div className="text-sm text-slate-400">
        当前时间段: <span className="font-medium text-slate-200">{currentPeriod}</span>
        {comparePeriod && (
          <>
            {' | 对比: '}<span className="font-medium text-slate-200">{comparePeriod}</span>
          </>
        )}
      </div>

      {loading && <p role="status" className="text-sm text-slate-400">正在更新数据…</p>}
      {(error || comparisonError) && <p role="alert" className="text-sm text-amber-400">{error || comparisonError}</p>}

      {isSingleDay && visible?.freshness && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>GitHub：{formatFreshnessLabel(visible.freshness.github)}</span>
          <span>贡献者：{formatFreshnessLabel(visible.freshness.contributors)}</span>
        </div>
      )}

      {!loading && previous?.freshness && <p className="text-xs text-slate-500">对比期 GitHub：{formatFreshnessLabel(previous.freshness.github)}；贡献者：{formatFreshnessLabel(previous.freshness.contributors)}</p>}

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">核心指标</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="animate-fade-in stagger-1"><ComparisonStatCard title="GitHub Stars" current={latestGitHub?.stars ?? '-'} previous={previousGitHub?.stars} change={metricChange(latestGitHub?.stars, previousGitHub?.stars)} icon="⭐" /></div>
          <div className="animate-fade-in stagger-2"><ComparisonStatCard title="GitHub Forks" current={latestGitHub?.forks ?? '-'} previous={previousGitHub?.forks} change={metricChange(latestGitHub?.forks, previousGitHub?.forks)} icon="🍴" /></div>
          <div className="animate-fade-in stagger-3"><ComparisonStatCard title="公众号关注" current={socialData.wechat?.followers ?? '-'} previous={previousSocial.wechat?.followers} change={metricChange(socialData.wechat?.followers, previousSocial.wechat?.followers)} icon="💚" /></div>
          <div className="animate-fade-in stagger-4"><ComparisonStatCard title="Twitter 粉丝" current={socialData.twitter?.followers ?? '-'} previous={previousSocial.twitter?.followers} change={metricChange(socialData.twitter?.followers, previousSocial.twitter?.followers)} icon="🐦" /></div>
          <div className="animate-fade-in stagger-5"><ComparisonStatCard title="贡献者数" current={currentContributors ?? '-'} previous={previousContributors} change={metricChange(currentContributors, previousContributors)} icon="👥" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {githubHistory.length > 0 && (
          <TrendChart
            title={`Stars 趋势 (${currentPeriod})`}
            data={githubHistory.map(h => ({ date: h.date, stars: h.stars, forks: h.forks }))}
            dataKey="stars"
            color="#6366F1"
          />
        )}
        {contributorHistory.length > 0 && (
          <TrendChart
            title={`贡献者增长趋势 (${currentPeriod})`}
            data={contributorHistory.map(h => ({ date: h.date, cumulative: h.cumulative_2026 }))}
            dataKey="cumulative"
            color="#A855F7"
          />
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">社交媒体</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(socialPlatforms).map(([key, { name }]) => (
            <div key={key} className="space-y-1">
              <PlatformCard
                name={name}
                platform={key}
                followers={socialData[key]?.followers}
                views={socialData[key]?.views}
                change={metricChange(socialData[key]?.followers, previousSocial[key]?.followers)}
                changePeriod={comparePeriod ? comparison?.mode === 'year-over-year' ? 'vs 去年同期' : 'vs 上期' : undefined}
              />
              <p className="px-1 text-xs text-slate-500">{formatFreshnessLabel(data?.freshness?.social[key])}</p>
              {!loading && comparison?.enabled && <p className="px-1 text-xs text-slate-500">对比期：{formatFreshnessLabel(previous?.freshness?.social[key])}</p>}
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-100">技术内容平台</h2><p className="mt-1 text-xs text-slate-500">发布日期：{dateRange.start} ~ {dateRange.end} · 当前累计阅读</p><p className="mt-1 text-xs text-slate-500"><LastUpdated value={contentOverview?.updated_at ?? null} /></p></div>
          <Link href={`/content?${contentDateQuery(dateRange)}`} className="inline-flex items-center gap-1 text-sm text-indigo-300">查看内容<ArrowRight size={16} /></Link>
        </header>
        {contentLoading && <p role="status" className="text-sm text-slate-400">正在更新内容汇总…</p>}
        {contentError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-400"><span>{contentError}</span><button type="button" onClick={() => { void refreshContent(); }} className="inline-flex items-center gap-1 text-slate-300"><RefreshCw size={14} />重试</button></div>}
        <ContentPlatformCards summaries={contentOverview?.platforms || []} loading={contentLoading} dateRange={dateRange} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityTimeline events={events} title="最新动态" />
      </div>
    </div>
  );
}

function exportDashboardData(data: DashboardData | null, period: string, contentOverview: ContentOverview | null, dateRange: ArticleDateRange) {
  if (!data) return;
  const rows: Record<string, unknown>[] = [];

  if (data.github.latest) {
    rows.push({ 指标: 'GitHub 概况', Stars: data.github.latest.stars, Forks: data.github.latest.forks, Watchers: data.github.latest.watchers, 'Open Issues': data.github.latest.open_issues, 'Open PRs': data.github.latest.open_prs, 贡献者: data.github.latest.contributors, Releases: data.github.latest.releases_count, 时间段: period });
  }

  if (data.contributors.latest) {
    rows.push({ 指标: '主仓库贡献者统计', '代码贡献者': data.contributors.latest.main_repo_code_contributors ?? data.github.latest?.contributors ?? 0, 时间段: period });
  }

  data.social.forEach(s => {
    rows.push({ 指标: '社交媒体', 平台: s.platform, 粉丝: s.followers, 阅读: s.views, 时间段: period });
  });

  rows.push(...contentOverviewExportRows(contentOverview?.platforms || [], dateRange));

  data.events.forEach(e => {
    rows.push({ 指标: '活动动态', 日期: e.date, 来源: e.source, 标题: e.title, 描述: e.description, 链接: e.url, 类型: e.event_type, 时间段: period });
  });

  if (data.github.history.length > 0) {
    rows.push(...data.github.history.map(h => ({ 指标: 'GitHub 历史', 日期: h.date, Stars: h.stars, Forks: h.forks, 贡献者: h.contributors, 时间段: period })));
  }

  if (data.contributors.history.length > 0) {
    rows.push(...data.contributors.history.map(h => ({ 指标: '贡献者历史', 日期: h.date, '2026 累计': h.cumulative_2026, '每日新增': h.new_contributors_daily, 时间段: period })));
  }

  downloadCSV(rows, `ivorysql-dashboard-${period.replace(/[~ ]/g, '_')}`);
}
