'use client';

import { useEffect, useState } from 'react';
import { downloadCSV } from '@/lib/csv-utils';

interface Participant {
  id: number;
  name: string;
  avatar_url: string | null;
  title: string | null;
  bio: string | null;
  joined_date: string | null;
  total_points: number;
}

interface Contribution {
  id: number;
  participant_id: number;
  category: string;
  type: string;
  title: string | null;
  url: string | null;
  points: number;
  date: string | null;
  notes: string | null;
}

const levelBadge = (points: number) => points >= 300
  ? { label: '高级布道者', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }
  : points >= 100
  ? { label: '社区布道者', color: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' }
  : { label: '新星', color: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };

const categoryColors: Record<string, string> = {
  '内容创作': 'bg-blue-500/20 text-blue-300',
  '活动参与': 'bg-green-500/20 text-green-300',
  '社区贡献': 'bg-purple-500/20 text-purple-300',
  '其他': 'bg-slate-500/20 text-slate-300',
};

export default function EvangelistPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contributions, setContributions] = useState<Record<number, Contribution[]>>({});
  const [loadingContributions, setLoadingContributions] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/evangelist', { credentials: 'include' });
      if (res.ok) setParticipants(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function toggleExpand(pid: number) {
    if (expandedId === pid) {
      setExpandedId(null);
      return;
    }
    setExpandedId(pid);
    if (!contributions[pid]) {
      setLoadingContributions(true);
      try {
        const res = await fetch(`/api/evangelist?participant_id=${pid}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setContributions(prev => ({ ...prev, [pid]: data.contributions || [] }));
        }
      } catch (e) { console.error(e); }
      finally { setLoadingContributions(false); }
    }
  }

  function handleExport() {
    const rows = participants.map((p, i) => ({
      排名: i + 1,
      姓名: p.name,
      头衔: p.title || '',
      积分: p.total_points,
      等级: levelBadge(p.total_points).label,
      加入日期: p.joined_date || '',
      简介: p.bio || '',
    }));
    downloadCSV(rows, 'ivorysql-evangelist-2026');
  }

  if (loading) {
    return <div className="space-y-6"><div className="card p-8 h-48 animate-pulse" /></div>;
  }

  const top3 = participants.slice(0, 3);

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
              <h1 className="text-2xl font-bold text-slate-100">布道者计划 2026</h1>
              <p className="text-slate-500 text-sm">共 {participants.length} 人参与 · {participants.filter(p => p.total_points >= 100).length} 位社区布道者 · {participants.filter(p => p.total_points >= 300).length} 位高级布道者</p>
            </div>
          </div>
          <button onClick={handleExport} className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 text-sm transition-colors">导出 CSV</button>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((p, i) => (
          <div key={p.id} className="card p-6 text-center relative cursor-pointer" onClick={() => toggleExpand(p.id)}>
            <div className="absolute top-3 left-3 text-2xl">{['🥇', '🥈', '🥉'][i]}</div>
            <div className="absolute top-3 right-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${levelBadge(p.total_points).color}`}>{levelBadge(p.total_points).label}</span>
            </div>
            {p.avatar_url && <img src={p.avatar_url} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />}
            <div className="font-bold text-lg text-slate-200 mb-1">{p.name}</div>
            {p.title && <div className="text-slate-400 text-sm mb-2">{p.title}</div>}
            <div className="text-3xl font-bold text-amber-400">{p.total_points} <span className="text-sm text-slate-500">分</span></div>
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
              <th className="text-left py-3 px-4 font-medium text-slate-400 hidden md:table-cell">等级</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => {
              const level = levelBadge(p.total_points);
              const isExpanded = expandedId === p.id;
              const memberContributions = contributions[p.id] || [];
              return (
                <>
                  <tr
                    key={p.id}
                    onClick={() => toggleExpand(p.id)}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-500/10' : ''}`}
                  >
                    <td className="py-3 px-4 text-slate-500 font-mono">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-400 text-xs">{p.name[0]}</div>
                        )}
                        <span className="font-medium text-slate-200">
                          {p.name}
                          <span className="ml-2 text-xs text-slate-500">{isExpanded ? '▲ 收起' : '▼ 展开'}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 hidden md:table-cell">{p.title || '-'}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-200">{p.total_points}</td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${level.color}`}>{level.label}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${p.id}-detail`} className="border-b border-slate-700/50 bg-slate-800/30">
                      <td colSpan={5} className="py-4 px-4">
                        {loadingContributions ? (
                          <div className="text-slate-500 text-center py-4">加载中...</div>
                        ) : memberContributions.length === 0 ? (
                          <div className="text-slate-500 text-center py-4">暂无贡献记录</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="text-left py-2 px-3 font-medium text-slate-500">日期</th>
                                  <th className="text-left py-2 px-3 font-medium text-slate-500">类别</th>
                                  <th className="text-left py-2 px-3 font-medium text-slate-500">类型</th>
                                  <th className="text-left py-2 px-3 font-medium text-slate-500">内容</th>
                                  <th className="text-right py-2 px-3 font-medium text-slate-500 w-16">积分</th>
                                </tr>
                              </thead>
                              <tbody>
                                {memberContributions.map((c) => (
                                  <tr key={c.id} className="border-b border-slate-700/30">
                                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{c.date || '-'}</td>
                                    <td className="py-2 px-3">
                                      <span className={`px-1.5 py-0.5 rounded text-xs ${categoryColors[c.category] || categoryColors['其他']}`}>
                                        {c.category}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-300">{c.type}</td>
                                    <td className="py-2 px-3 text-slate-200 max-w-xs truncate">
                                      {c.url ? (
                                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                                          {c.title || c.url}
                                        </a>
                                      ) : (c.title || '-')}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-amber-400">+{c.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-right text-xs text-slate-500 mt-2">
                              共 {memberContributions.length} 条记录 · 合计 {memberContributions.reduce((s, c) => s + (c.points || 0), 0)} 分
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
