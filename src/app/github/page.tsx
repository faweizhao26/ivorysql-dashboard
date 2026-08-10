'use client';

import { useEffect, useState } from 'react';
import { StatCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { TrendChart, BarChartComponent } from '@/components/Charts';
import { ActivityTimeline } from '@/components/Timeline';
import { downloadCSV } from '@/lib/csv-utils';

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
      main_repo_issue_creators?: number;
      main_repo_pr_creators?: number;
      main_repo_unique_creators?: number;
      main_repo_issue_count?: number;
      main_repo_pr_count?: number;
      main_repo_activity_since?: string;
      main_repo_code_contributors?: number;
      main_repo_top_contributors?: Array<{
        login: string;
        issue_count: number;
        pr_count: number;
        total: number;
      }>;
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
  const [syncVer, setSyncVer] = useState(0);

  const isSingleDay = dateRange.start === dateRange.end;

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setSyncVer(v => v + 1);
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
  }, [dateRange, syncVer]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <h1 className="text-2xl font-bold text-slate-100">GitHub 数据</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="h-4 w-20 bg-slate-700 rounded mb-4"></div>
              <div className="h-8 w-24 bg-slate-700 rounded mb-2"></div>
              <div className="h-3 w-16 bg-slate-700 rounded"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 h-72">
            <div className="h-6 w-32 bg-slate-700 rounded mb-4"></div>
            <div className="h-full bg-slate-700/50 rounded"></div>
          </div>
          <div className="card p-5 h-72">
            <div className="h-6 w-32 bg-slate-700 rounded mb-4"></div>
            <div className="h-full bg-slate-700/50 rounded"></div>
          </div>
        </div>
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
  const mainRepoContributors = latestContributors?.main_repo_top_contributors || [];
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
              {displayDate}
            </span>
          )}
          <button
            onClick={() => exportGitHubData(data, currentPeriod)}
            className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            导出 CSV
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {syncing ? '同步中...' : '刷新'}
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
        <h2 className="text-lg font-semibold text-slate-100 mb-4">主仓库代码贡献者</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="代码贡献者"
            value={latestContributors?.main_repo_code_contributors ?? latestGitHub?.contributors ?? 0}
            icon="👥"
          />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-semibold text-slate-100">主仓库 Issue / PR 贡献者</h2>
          <span className="text-xs text-slate-400">
            {latestContributors?.main_repo_activity_since || '待同步'} 至今 · 仅统计创建者
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="去重贡献者"
            value={latestContributors?.main_repo_unique_creators ?? 0}
            icon="👥"
          />
          <StatCard
            title="Issue 创建数"
            value={latestContributors?.main_repo_issue_count ?? 0}
            icon="📋"
          />
          <StatCard
            title="PR 创建数"
            value={latestContributors?.main_repo_pr_count ?? 0}
            icon="🔀"
          />
          <StatCard
            title="Issue 创建者"
            value={latestContributors?.main_repo_issue_creators ?? 0}
            icon="📝"
          />
          <StatCard
            title="PR 创建者"
            value={latestContributors?.main_repo_pr_creators ?? 0}
            icon="✍️"
          />
        </div>
        {mainRepoContributors.length > 0 && (
          <div className="card p-5 mt-4">
            <h3 className="text-base font-semibold text-slate-100 mb-3">主仓库贡献者 Top 10</h3>
            <div className="divide-y divide-slate-700/60">
              {mainRepoContributors.map((contributor, index) => (
                <div key={contributor.login} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-300">{index + 1}. {contributor.login}</span>
                  <span className="text-slate-400">
                    Issue {contributor.issue_count} · PR {contributor.pr_count} · 合计 {contributor.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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

function exportGitHubData(data: GitHubPageData | null, period: string) {
  if (!data) return;

  const rows: Record<string, any>[] = [];

  if (data.github.history.length > 0) {
    rows.push(...data.github.history.map(h => ({
      指标: 'GitHub 仓库',
      日期: h.date,
      Stars: h.stars,
      Forks: h.forks,
      贡献者: h.contributors,
      时间段: period,
    })));
  }

  if (data.contributors.history.length > 0) {
    rows.push(...data.contributors.history.map(h => ({
      指标: '2026 贡献者',
      日期: h.date,
      '2026 累计新增': h.cumulative_2026,
      '每日新增': h.new_contributors_daily,
      时间段: period,
    })));
  }

  if (data.contributors.latest?.main_repo_unique_creators !== undefined) {
    rows.push({
      指标: '主仓库 Issue/PR 贡献者',
      去重贡献者: data.contributors.latest.main_repo_unique_creators,
      Issue创建数: data.contributors.latest.main_repo_issue_count,
      PR创建数: data.contributors.latest.main_repo_pr_count,
      统计起点: data.contributors.latest.main_repo_activity_since,
      时间段: period,
    });
  }

  const filteredEvents = (data.events || []).filter(
    (e: any) => e.event_type === 'github_issue' || e.event_type === 'github_pr'
  );
  if (filteredEvents.length > 0) {
    rows.push(...filteredEvents.map((e: any) => ({
      指标: 'Issue/PR 动态',
      日期: e.date,
      来源: e.source,
      标题: e.title,
      描述: e.description,
      链接: e.url,
      类型: e.event_type,
      时间段: period,
    })));
  }

  downloadCSV(rows, `ivorysql-github-${period.replace(/[~ ]/g, '_')}`);
}
