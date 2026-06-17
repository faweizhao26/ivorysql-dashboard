'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ComparisonStatCard, PlatformCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { TrendChart } from '@/components/Charts';
import { ActivityTimeline } from '@/components/Timeline';
import { PlatformIcon } from '@/components/PlatformIcon';
import { downloadCSV } from '@/lib/csv-utils';

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
  downloads: Array<{
    date: string;
    github_total: number;
    docker_total: number;
  }>;
}

const socialPlatforms: Record<string, { name: string }> = {
  wechat: { name: '公众号' },
  shipinhao: { name: '视频号' },
  twitter: { name: 'Twitter' },
  bilibili: { name: 'B站' },
  youtube: { name: 'YouTube' },
};

const contentPlatforms: Record<string, { name: string }> = {
  csdn: { name: 'CSDN' },
  juejin: { name: '掘金' },
  modb: { name: '墨天轮' },
  oschina: { name: '开源中国' },
  sf: { name: '思否' },
  ctoutiao: { name: '51CTO' },
  itpub: { name: 'ITPUB' },
  toutiao: { name: '头条号' },
  ifclub: { name: 'IFCLUB' },
};

export default function HomePage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isSingleDay = dateRange.start === dateRange.end;

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        });
        if (comparison?.enabled) {
          params.set('compare', 'true');
        }
        const res = await fetch(`/api/dashboard?${params}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange, comparison]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const github = data?.github;
  const contributors = data?.contributors;
  const social = data?.social || [];
  const articles = data?.articles || [];
  const events = data?.events || [];

  const githubHistory = github?.history || [];
  const contributorHistory = contributors?.history || [];

  const latestGitHub = github?.latest;
  const displayDate = isSingleDay ? dateRange.start : null;

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  let comparePeriod = '';
  if (comparison?.enabled && comparison.customRange) {
    comparePeriod = `${comparison.customRange.start} ~ ${comparison.customRange.end}`;
  }

  const socialData = social.reduce((acc, item) => {
    acc[item.platform] = item;
    return acc;
  }, {} as Record<string, { followers: number; views: number }>);

  const articleData = articles.reduce((acc, item) => {
    acc[item.platform] = item;
    return acc;
  }, {} as Record<string, { article_count: number; total_views: number }>);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/10 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">IvorySQL 社区数据中心</h1>
            <p className="text-slate-400 text-sm max-w-md">实时追踪 GitHub、社交媒体、内容平台的运营数据，助力社区增长决策。</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {displayDate && (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30 hidden sm:inline-flex">
                {displayDate}
              </span>
            )}
            <button
              onClick={() => exportDashboardData(data, currentPeriod)}
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

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">核心指标</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="animate-fade-in stagger-1"><ComparisonStatCard title="GitHub Stars" current={latestGitHub?.stars || 0} icon="⭐" periodLabel={comparePeriod ? 'vs 上期' : undefined} /></div>
          <div className="animate-fade-in stagger-2"><ComparisonStatCard title="GitHub Forks" current={latestGitHub?.forks || 0} icon="🍴" periodLabel={comparePeriod ? 'vs 上期' : undefined} /></div>
          <div className="animate-fade-in stagger-3"><ComparisonStatCard title="公众号关注" current={socialData.wechat?.followers || 0} icon="💚" periodLabel={comparePeriod ? 'vs 上期' : undefined} /></div>
          <div className="animate-fade-in stagger-4"><ComparisonStatCard title="Twitter 粉丝" current={socialData.twitter?.followers || 0} icon="🐦" periodLabel={comparePeriod ? 'vs 上期' : undefined} /></div>
          <div className="animate-fade-in stagger-5"><ComparisonStatCard title="贡献者数" current={contributors?.latest?.total_contributors || latestGitHub?.contributors || 0} icon="👥" periodLabel={comparePeriod ? 'vs 上期' : undefined} /></div>
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
            <PlatformCard
              key={key}
              name={name}
              platform={key}
              followers={socialData[key]?.followers}
              views={socialData[key]?.views}
              changePeriod={comparePeriod ? 'vs 上期' : undefined}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">技术内容平台</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(contentPlatforms).map(([key, { name }]) => (
            <PlatformCard
              key={key}
              name={name}
              platform={key}
              articles={articleData[key]?.article_count}
              views={articleData[key]?.total_views}
              changePeriod={comparePeriod ? 'vs 上期' : undefined}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityTimeline events={events} title="最新动态" />
      </div>
    </div>
  );
}

function exportDashboardData(data: DashboardData | null, period: string) {
  if (!data) return;
  const rows: Record<string, any>[] = [];

  if (data.github.latest) {
    rows.push({ 指标: 'GitHub 概况', Stars: data.github.latest.stars, Forks: data.github.latest.forks, Watchers: data.github.latest.watchers, 'Open Issues': data.github.latest.open_issues, 'Open PRs': data.github.latest.open_prs, 贡献者: data.github.latest.contributors, Releases: data.github.latest.releases_count, 时间段: period });
  }

  if (data.contributors.latest) {
    rows.push({ 指标: '贡献者统计', '历史贡献者总数': data.contributors.latest.total_contributors, '2026 前贡献者': data.contributors.latest.contributors_before_2026, '2026 累计新增': data.contributors.latest.cumulative_2026, '本月新增': data.contributors.latest.new_contributors_monthly, 时间段: period });
  }

  data.social.forEach(s => {
    rows.push({ 指标: '社交媒体', 平台: s.platform, 粉丝: s.followers, 阅读: s.views, 时间段: period });
  });

  data.articles.forEach(a => {
    rows.push({ 指标: '内容平台', 平台: a.platform, 文章数: a.article_count, 阅读量: a.total_views, 时间段: period });
  });

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
