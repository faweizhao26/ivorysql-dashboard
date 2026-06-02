'use client';

import { useEffect, useState } from 'react';
import { TrendChart } from '@/components/Charts';

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [liveRes, histRes] = await Promise.all([
          fetch('/api/downloads', { credentials: 'include' }),
          fetch('/api/dashboard?start=2025-01-01&end=2099-12-31&days=730', { credentials: 'include' }),
        ]);
        if (liveRes.ok) setDownloads(await liveRes.json());
        if (histRes.ok) {
          const d = await histRes.json();
          setHistory(d.downloads || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return <div className="space-y-6"><div className="card p-8 h-48 animate-pulse" /></div>;
  }

  const gh = downloads?.github;
  const dk = downloads?.docker;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/10 p-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">下载统计</h1>
            <p className="text-slate-500 text-sm">GitHub Release + Docker Hub + 国内镜像</p>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-6 text-center">
          <div className="text-slate-400 text-sm mb-2">🐙 GitHub Release</div>
          <div className="text-3xl font-bold text-slate-900 dark:bg-gradient-to-r dark:from-slate-100 dark:to-slate-300 dark:bg-clip-text dark:[-webkit-background-clip:text] dark:[-webkit-text-fill-color:transparent] dark:text-transparent">
            {gh?.total?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-slate-400 text-sm mb-2">🐳 Docker Hub</div>
          <div className="text-3xl font-bold text-slate-900 dark:bg-gradient-to-r dark:from-slate-100 dark:to-slate-300 dark:bg-clip-text dark:[-webkit-background-clip:text] dark:[-webkit-text-fill-color:transparent] dark:text-transparent">
            {dk?.total?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-slate-400 text-sm mb-2">📦 合计</div>
          <div className="text-3xl font-bold text-slate-900 dark:bg-gradient-to-r dark:from-slate-100 dark:to-slate-300 dark:bg-clip-text dark:[-webkit-background-clip:text] dark:[-webkit-text-fill-color:transparent] dark:text-transparent">
            {((gh?.total || 0) + (dk?.total || 0)).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
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
          {dk?.repos?.map((r: any) => (
            <div key={r.name} className="card p-4 flex justify-between items-center">
              <span className="text-sm text-slate-300">{r.name}</span>
              <span className="font-bold text-slate-200">{r.pulls.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GitHub Releases Detail */}
      {gh?.releases?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Release 版本下载</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {gh.releases.slice(0, 15).map((r: any) => (
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
