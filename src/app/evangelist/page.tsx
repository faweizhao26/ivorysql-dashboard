'use client';

import { useEffect, useState } from 'react';
import { downloadCSV } from '@/lib/csv-utils';

interface Participant {
  id: number;
  name: string;
  avatar_url: string | null;
  title: string | null;
  points: number;
  contribution_links: any;
  joined_date: string | null;
  bio: string | null;
}

export default function EvangelistPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/evangelist', { credentials: 'include' });
      if (res.ok) setParticipants(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function handleExport() {
    const rows = participants.map(p => ({
      排名: participants.indexOf(p) + 1,
      姓名: p.name,
      头衔: p.title || '',
      积分: p.points,
      加入日期: p.joined_date || '',
      个人简介: p.bio || '',
      贡献链接: Array.isArray(p.contribution_links) ? p.contribution_links.join('; ') : '',
    }));
    downloadCSV(rows, 'ivorysql-evangelist-program');
  }

  if (loading) {
    return <div className="space-y-6"><div className="card p-8 h-48 animate-pulse" /></div>;
  }

  // Top 3
  const top3 = participants.slice(0, 3);
  const rankColors = ['#f59e0b', '#94a3b8', '#d97706'];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/10 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">布道者计划</h1>
              <p className="text-slate-500 text-sm">IvorySQL Evangelist Program · 共 {participants.length} 人参与</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 text-sm transition-colors">导出 CSV</button>
          </div>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((p, i) => (
          <div key={p.id} className="card p-6 text-center relative">
            <div className="absolute top-3 left-3 text-2xl">{['🥇', '🥈', '🥉'][i]}</div>
            {p.avatar_url && <img src={p.avatar_url} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />}
            <div className="font-bold text-lg text-slate-200 mb-1">{p.name}</div>
            {p.title && <div className="text-slate-400 text-sm mb-2">{p.title}</div>}
            <div className="text-3xl font-bold text-amber-400">{p.points} <span className="text-sm text-slate-500">分</span></div>
          </div>
        ))}
      </div>

      {/* Full List */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 font-medium text-slate-400 w-12">#</th>
              <th className="text-left py-3 px-4 font-medium text-slate-400">姓名</th>
              <th className="text-left py-3 px-4 font-medium text-slate-400 hidden md:table-cell">头衔</th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 w-20">积分</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-3 px-4 text-slate-500 font-mono">{i + 1}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-400 text-xs">{p.name[0]}</div>
                    )}
                    <div>
                      <div className="font-medium text-slate-200">{p.name}</div>
                      {p.bio && <div className="text-xs text-slate-500 max-w-xs truncate">{p.bio}</div>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400 hidden md:table-cell">{p.title || '-'}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-200">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
