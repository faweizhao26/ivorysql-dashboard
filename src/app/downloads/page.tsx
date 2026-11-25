'use client';

import { useEffect, useState } from 'react';
import { MultiLineChart } from '@/components/Charts';
import { Download, GitFork, Container, Package } from 'lucide-react';
import type { DownloadStatsHistory } from '@/lib/db';
import type { DownloadSummary } from '@/lib/download-stats';

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadSummary | null>(null);
  const [history, setHistory] = useState<DownloadStatsHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const options = { credentials: 'include' as const, signal: controller.signal };
    async function loadSummary() {
      try {
        const response = await fetch('/api/downloads', options);
        const value = await response.json();
        // A partial (502) response can still contain usable totals and source status.
        if (!value?.github || !value?.docker) throw new Error('Missing download summary');
        if (!controller.signal.aborted) setDownloads(value);
      } catch {
        if (!controller.signal.aborted) setError('下载统计暂时不可用，请稍后重试');
      }
    }

    async function loadHistory() {
      try {
        const response = await fetch('/api/downloads/history', options);
        if (!response.ok) throw new Error('Download history unavailable');
        const value = await response.json();
        if (!Array.isArray(value?.downloads)) throw new Error('Missing download history');
        if (!controller.signal.aborted) setHistory(value.downloads);
      } catch {
        if (!controller.signal.aborted) setHistoryError(true);
      }
    }
    void loadSummary();
    void loadHistory();
    return () => controller.abort();
  }, []);

  const gh = downloads?.github;
  const dk = downloads?.docker;
  const dockerRepos = dk?.repos ?? [];
  const githubReleases = gh?.releases ?? [];
  const combinedTotal = typeof gh?.total === 'number' && typeof dk?.total === 'number' ? gh.total + dk.total : null;
  function sourceLabel(source: typeof gh | typeof dk) {
    if (!downloads && !error) return '正在加载统计…';
    if (!source || source.status === 'unavailable') return '暂无可用数据';
    return source.status === 'stale' ? `获取失败，显示 ${source.data_date} 历史统计` : '实时统计';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
          <Download size={24} className="shrink-0 text-indigo-400" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-100">下载统计</h1>
            <p className="text-slate-500 text-sm">GitHub Release + Docker Hub</p>
          </div>
      </div>

      {(error || downloads?.partial) && <p role="alert" className="rounded border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{error || '部分下载统计获取失败，历史数据已保留。'}</p>}

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 text-center">
          <div className="text-slate-400 text-sm mb-2 inline-flex items-center gap-2"><GitFork size={16} />GitHub Release</div>
          <div className="text-3xl font-bold text-slate-900 dark:bg-gradient-to-r dark:from-slate-100 dark:to-slate-300 dark:bg-clip-text dark:[-webkit-background-clip:text] dark:[-webkit-text-fill-color:transparent] dark:text-transparent">
            {gh?.total?.toLocaleString() ?? '-'}
          </div>
          <p className="mt-2 text-xs text-slate-400">{sourceLabel(gh)}</p>
          {gh?.error && <p className="mt-1 break-words text-xs text-amber-400">{gh.error}</p>}
        </div>
        <div className="card p-6 text-center">
          <div className="text-slate-400 text-sm mb-2 inline-flex items-center gap-2"><Container size={16} />Docker Hub</div>
          <div className="text-3xl font-bold text-slate-900 dark:bg-gradient-to-r dark:from-slate-100 dark:to-slate-300 dark:bg-clip-text dark:[-webkit-background-clip:text] dark:[-webkit-text-fill-color:transparent] dark:text-transparent">
            {dk?.total?.toLocaleString() ?? '-'}
          </div>
          <p className="mt-2 text-xs text-slate-400">{sourceLabel(dk)}</p>
          {dk?.error && <p className="mt-1 break-words text-xs text-amber-400">{dk.error}</p>}
        </div>
        <div className="card p-6 text-center">
          <div className="text-slate-400 text-sm mb-2 inline-flex items-center gap-2"><Package size={16} />合计</div>
          <div className="text-3xl font-bold text-slate-900 dark:bg-gradient-to-r dark:from-slate-100 dark:to-slate-300 dark:bg-clip-text dark:[-webkit-background-clip:text] dark:[-webkit-text-fill-color:transparent] dark:text-transparent">
            {combinedTotal?.toLocaleString() ?? '-'}
          </div>
          {downloads?.partial && combinedTotal !== null && <p className="mt-2 text-xs text-amber-400">包含历史统计</p>}
        </div>
      </div>

      {/* Trend Chart */}
      {historyError ? (
        <p role="status" className="text-sm text-amber-400">历史趋势加载失败，请稍后重试</p>
      ) : history?.length ? (
        <MultiLineChart
          title="累计下载趋势（近 365 天）"
          data={history.map(d => ({ date: d.date, 'GitHub Release': d.github_total, 'Docker Hub': d.docker_total }))}
          dataKeys={['GitHub Release', 'Docker Hub']}
          colors={['var(--chart-primary)', 'var(--chart-secondary)']}
        />
      ) : (
        <p role="status" className="text-sm text-slate-400">{history ? '近 365 天暂无下载快照' : '正在加载下载趋势…'}</p>
      )}

      {/* Docker Repos Detail */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Docker 镜像明细</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dockerRepos.map((r) => (
            <div key={r.name} className="card p-4 flex justify-between items-center">
              <span className="text-sm text-slate-300">{r.name}</span>
              <span className="font-bold text-slate-200">{r.pulls.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GitHub Releases Detail */}
      {githubReleases.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Release 版本下载</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {githubReleases.slice(0, 15).map((r) => (
              <div key={r.tag} className="card p-4">
                <div className="text-sm font-bold text-slate-200 mb-1">{r.tag}</div>
                <div className="text-xs text-slate-500 mb-2">{r.date}</div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">{r.assets?.length || 0} 个文件</span>
                  <span className="font-bold text-slate-200 text-sm">{r.total.toLocaleString()} 次</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
