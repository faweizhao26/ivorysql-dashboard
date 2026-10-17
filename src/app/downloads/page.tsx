'use client';

import { useEffect, useState } from 'react';
import { TrendChart } from '@/components/Charts';
import { Download, GitFork, Container, Package } from 'lucide-react';
import type { DownloadSummary } from '@/lib/download-stats';

interface DownloadHistoryRow {
  date: string;
  github_total: number;
  docker_total: number;
}

interface DashboardDownloadsResponse {
  downloads?: DownloadHistoryRow[];
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadSummary | null>(null);
  const [history, setHistory] = useState<DownloadHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        async function readJSON(url: string) {
          const response = await fetch(url, { credentials: 'include' });
          return { ok: response.ok, data: await response.json() };
        }
        const [live, historical] = await Promise.allSettled([
          readJSON('/api/downloads'),
          readJSON('/api/dashboard?start=2025-01-01&end=2099-12-31&days=730&include=downloads'),
        ]);
        if (live.status === 'fulfilled') {
          const value = live.value.data;
          if (value?.github && value?.docker) setDownloads(value as DownloadSummary);
          else setError('下载统计暂时不可用，请稍后重试');
        } else setError('下载统计暂时不可用，请稍后重试');
        if (historical.status === 'fulfilled' && historical.value.ok) {
          const d = historical.value.data as DashboardDownloadsResponse;
          setHistory(d.downloads || []);
        } else {
          setHistoryError(true);
        }
      } catch (e) { console.error(e); setError('下载统计加载失败，请稍后重试'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return <div className="space-y-6"><div className="card p-8 h-48 animate-pulse" /></div>;
  }

  const gh = downloads?.github;
  const dk = downloads?.docker;
  const dockerRepos = dk?.repos ?? [];
  const githubReleases = gh?.releases ?? [];
  const combinedTotal = typeof gh?.total === 'number' && typeof dk?.total === 'number' ? gh.total + dk.total : null;
  function sourceLabel(source: typeof gh | typeof dk) {
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
      {historyError && <p role="status" className="text-sm text-amber-400">历史趋势加载失败，请稍后重试</p>}
      {history.length > 1 && (
        <TrendChart
          title="下载趋势"
          data={history.map(d => ({ date: d.date, github: d.github_total, docker: d.docker_total }))}
          dataKey="github"
          color="#6366F1"
        />
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
