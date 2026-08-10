'use client';

import { useEffect, useState } from 'react';
import { StatCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange } from '@/components/TimeRangeSelector';
import { TrendChart } from '@/components/Charts';
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
      main_repo_monthly_activity?: Array<{
        month: string;
        contributor_count: number;
        new_contributor_count: number;
        issue_count: number;
        pr_count: number;
        new_contributors: string[];
        contributors: Array<{
          login: string;
          issue_count: number;
          pr_count: number;
          total: number;
        }>;
        contributions: Array<{
          number: number;
          type: 'issue' | 'pr';
          author: string;
          created_at: string;
          title?: string;
          url?: string;
        }>;
      }>;
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
  const [data, setData] = useState<GitHubPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncVer, setSyncVer] = useState(0);

  const isSingleDay = dateRange.start === dateRange.end;

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setSyncVer(v => v + 1);
      } else {
        const body = await res.json().catch(() => null);
        setSyncError(body?.error || `同步失败（${res.status}）`);
      }
    } catch (err) {
      console.error(err);
      setSyncError('无法连接同步服务');
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
    e => e.event_type === 'github_issue' || e.event_type === 'github_pr'
  );

  const githubHistory = github?.history || [];

  const latestGitHub = github?.latest;
  const latestContributors = contributors?.latest;
  const mainRepoContributors = latestContributors?.main_repo_top_contributors || [];
  const storedMonthlyActivity = latestContributors?.main_repo_monthly_activity || [];
  const monthlyActivity = storedMonthlyActivity.length > 0
    ? Array.from({ length: 12 }, (_, index) => storedMonthlyActivity.find(month => month.month === `2026-${String(index + 1).padStart(2, '0')}`) || ({
      month: `2026-${String(index + 1).padStart(2, '0')}`,
      contributor_count: 0,
      new_contributor_count: 0,
      issue_count: 0,
      pr_count: 0,
      new_contributors: [],
      contributors: [],
      contributions: [],
    }))
    : [];
  const annualContributors = new Set(storedMonthlyActivity.flatMap(month => month.contributors.map(contributor => contributor.login)));
  const annualNewContributors = storedMonthlyActivity.reduce((sum, month) => sum + month.new_contributor_count, 0);
  const annualIssues = storedMonthlyActivity.reduce((sum, month) => sum + month.issue_count, 0);
  const annualPrs = storedMonthlyActivity.reduce((sum, month) => sum + month.pr_count, 0);
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
      }} />

      <div className="text-sm text-slate-400">
        当前时间段: <span className="font-medium text-slate-200">{currentPeriod}</span>
      </div>

      {syncError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          GitHub 同步失败：{syncError}
        </div>
      )}

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

      {monthlyActivity.length > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline gap-3 mb-4">
            <h2 className="text-lg font-semibold text-slate-100">2026 年主仓库贡献明细</h2>
            <span className="text-xs text-slate-400">首次贡献者按仓库历史首次出现时间计算</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard title="2026 Issue/PR 参与者" value={annualContributors.size} icon="👥" />
            <StatCard title="2026 首次创建者" value={annualNewContributors} icon="✨" />
            <StatCard title="Issue" value={annualIssues} icon="📋" />
            <StatCard title="PR" value={annualPrs} icon="🔀" />
          </div>
          <div className="space-y-3">
            {monthlyActivity.map(month => (
              <details key={month.month} className="card overflow-hidden">
                <summary className="cursor-pointer list-none px-5 py-4 hover:bg-slate-800/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-slate-100">{month.month}</span>
                    <span className="text-sm text-slate-400">
                      {month.contributor_count} 位参与者 · 新增 {month.new_contributor_count} · Issue {month.issue_count} · PR {month.pr_count}
                    </span>
                  </div>
                </summary>
                <div className="border-t border-slate-700/60 p-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-3">本月贡献者</h3>
                    <div className="space-y-2">
                      {month.contributors.map(contributor => (
                        <div key={contributor.login} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{contributor.login}</span>
                          <span className="text-slate-500">Issue {contributor.issue_count} · PR {contributor.pr_count}</span>
                        </div>
                      ))}
                    </div>
                    {month.new_contributors.length > 0 && (
                      <p className="text-xs text-emerald-400 mt-4">本月首次贡献：{month.new_contributors.join('、')}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-3">具体贡献</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {month.contributions.map(contribution => (
                        <div key={`${contribution.type}-${contribution.number}`} className="text-sm">
                          <a
                            href={contribution.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-300 hover:text-indigo-200"
                          >
                            {contribution.type === 'issue' ? 'Issue' : 'PR'} #{contribution.number} · {contribution.title || '未命名贡献'}
                          </a>
                          <div className="text-xs text-slate-500">{contribution.author} · {contribution.created_at}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

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

      <ActivityTimeline events={events} title="IvorySQL Issue/PR 动态" />
    </div>
  );
}

function exportGitHubData(data: GitHubPageData | null, period: string) {
  if (!data) return;

  const rows: Record<string, unknown>[] = [];

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

  for (const month of data.contributors.latest?.main_repo_monthly_activity || []) {
    rows.push({
      指标: '2026 月度贡献汇总',
      月份: month.month,
      参与者: month.contributor_count,
      首次贡献者: month.new_contributor_count,
      Issue: month.issue_count,
      PR: month.pr_count,
      时间段: period,
    });
    rows.push(...month.contributions.map(contribution => ({
      指标: '具体贡献',
      月份: month.month,
      类型: contribution.type === 'issue' ? 'Issue' : 'PR',
      编号: contribution.number,
      贡献者: contribution.author,
      标题: contribution.title,
      日期: contribution.created_at,
      链接: contribution.url,
      时间段: period,
    })));
  }

  const filteredEvents = (data.events || []).filter(
    e => e.event_type === 'github_issue' || e.event_type === 'github_pr'
  );
  if (filteredEvents.length > 0) {
    rows.push(...filteredEvents.map(e => ({
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
