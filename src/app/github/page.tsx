'use client';

import { useEffect, useState } from 'react';
import { StatCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { TrendChart, BarChartComponent } from '@/components/Charts';
import { ActivityTimeline } from '@/components/Timeline';

interface GitHubPageData {
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
      new_contributors_daily: number;
      new_contributors_weekly: number;
      new_contributors_monthly: number;
      new_contributors_quarterly: number;
    } | null;
    history: Array<{
      date: string;
      cumulative_2026: number;
      new_contributors_daily: number;
    }>;
  };
  events: Array<{
    date: string;
    source: string;
    title: string;
    description: string;
    url: string;
    event_type: string;
  }>;
}

export default function GitHubPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<GitHubPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isSingleDay = dateRange.start === dateRange.end;

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        });
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
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const github = data?.github;
  const contributors = data?.contributors;
  const events = (data?.events || []).filter(
    (e: any) => e.event_type === 'github_issue' || e.event_type === 'github_pr'
  );

  const githubHistory = github?.history || [];
  const contributorHistory = contributors?.history || [];

  const latestGitHub = github?.latest;
  const latestContributors = contributors?.latest;
  const prevGitHub = githubHistory.length > 1 ? githubHistory[githubHistory.length - 2] : null;

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  const displayDate = isSingleDay ? dateRange.start : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <h1 className="text-2xl font-bold text-slate-100">GitHub 数据</h1>
        </div>
        <div className="flex items-center gap-3">
          {displayDate && (
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30">
              📅 存档数据: {displayDate}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {syncing ? '同步中...' : '🔄 立即刷新'}
          </button>
        </div>
      </div>

      <TimeRangeSelector onRangeChange={(range) => {
        setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
        setComparison(range.comparison);
      }} />

      <div className="text-sm text-slate-400">
        当前时间段: <span className="font-medium text-slate-200">{currentPeriod}</span>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">仓库基础指标</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Stars"
            value={latestGitHub?.stars || 0}
            change={prevGitHub ? calculateChange(latestGitHub?.stars || 0, prevGitHub.stars) : undefined}
            icon="⭐"
          />
          <StatCard
            title="Forks"
            value={latestGitHub?.forks || 0}
            change={prevGitHub ? calculateChange(latestGitHub?.forks || 0, prevGitHub.forks) : undefined}
            icon="🍴"
          />
          <StatCard
            title="Watchers"
            value={latestGitHub?.watchers || 0}
            icon="👀"
          />
          <StatCard
            title="Open Issues"
            value={latestGitHub?.open_issues || 0}
            icon="📋"
          />
          <StatCard
            title="Open PRs"
            value={latestGitHub?.open_prs || 0}
            icon="🔀"
          />
          <StatCard
            title="Releases"
            value={latestGitHub?.releases_count || 0}
            icon="🚀"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">贡献者统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="历史贡献者总数"
            value={latestContributors?.total_contributors || latestGitHub?.contributors || 0}
            icon="👥"
          />
          <StatCard
            title="2026 前贡献者"
            value={latestContributors?.contributors_before_2026 || 0}
            icon="📅"
          />
          <StatCard
            title="2026 累计新增"
            value={latestContributors?.cumulative_2026 || 0}
            icon="📈"
          />
          <StatCard
            title="本月新增"
            value={latestContributors?.new_contributors_monthly || 0}
            icon="📆"
          />
          <StatCard
            title="本季度新增"
            value={latestContributors?.new_contributors_quarterly || 0}
            icon="🗓️"
          />
          <StatCard
            title="本周新增"
            value={latestContributors?.new_contributors_weekly || 0}
            icon="📅"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {githubHistory.length > 0 && (
          <TrendChart
            title={`Stars 趋势 (${currentPeriod})`}
            data={githubHistory.map(h => ({ date: h.date, stars: h.stars }))}
            dataKey="stars"
            color="#6366F1"
          />
        )}
        {githubHistory.length > 0 && (
          <TrendChart
            title={`Forks 趋势 (${currentPeriod})`}
            data={githubHistory.map(h => ({ date: h.date, forks: h.forks }))}
            dataKey="forks"
            color="#22D3EE"
          />
        )}
      </div>

      {contributorHistory.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart
            title={`2026 累计贡献者 (${currentPeriod})`}
            data={contributorHistory.map(h => ({ date: h.date, cumulative: h.cumulative_2026 }))}
            dataKey="cumulative"
            color="#A855F7"
          />
          <BarChartComponent
            title={`每日新增贡献者 (${currentPeriod})`}
            data={contributorHistory.map(h => ({ date: h.date, daily: h.new_contributors_daily }))}
            dataKey="daily"
            color="#EC4899"
          />
        </div>
      )}

      <ActivityTimeline events={events} title="IvorySQL Issue/PR 动态" />
    </div>
  );
}
