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
  const [editing, setEditing] = useState<Partial<Participant> | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/evangelist', { credentials: 'include' });
      if (res.ok) setParticipants(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const method = editing.id ? 'PUT' : 'POST';
    const body = editing.id ? editing : { ...editing, id: undefined };
    await fetch('/api/evangelist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false); setEditing(null); fetchData();
  }

  function handleEdit(p: Participant) {
    setEditing({ ...p, contribution_links: p.contribution_links || [] });
    setShowModal(true);
  }

  function handleAdd() {
    setEditing({ name: '', points: 0, title: '', avatar_url: '', joined_date: '', bio: '', contribution_links: [] });
    setShowModal(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除？')) return;
    await fetch(`/api/evangelist?id=${id}`, { method: 'DELETE' });
    fetchData();
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
            <button onClick={handleAdd} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 text-sm transition-colors">+ 添加成员</button>
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
              <th className="text-right py-3 px-4 font-medium text-slate-400 w-24">操作</th>
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
                <td className="py-3 px-4 text-right">
                  <button onClick={() => handleEdit(p)} className="text-indigo-400 hover:text-indigo-300 text-xs mr-2">编辑</button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 pt-10 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-xl border border-slate-700 mb-10">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">{editing.id ? '编辑成员' : '添加成员'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">姓名 *</label>
                  <input required value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">头衔</label>
                  <input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="如：核心贡献者" className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">头像 URL</label>
                  <input value={editing.avatar_url || ''} onChange={e => setEditing({ ...editing, avatar_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">积分</label>
                  <input type="number" value={editing.points || 0} onChange={e => setEditing({ ...editing, points: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">个人简介</label>
                <textarea value={editing.bio || ''} onChange={e => setEditing({ ...editing, bio: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">加入日期</label>
                <input type="date" value={editing.joined_date || ''} onChange={e => setEditing({ ...editing, joined_date: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">贡献链接（每行一个）</label>
                <textarea
                  value={Array.isArray(editing.contribution_links) ? editing.contribution_links.join('\n') : ''}
                  onChange={e => setEditing({ ...editing, contribution_links: e.target.value.split('\n').filter(l => l.trim()) })}
                  rows={3} placeholder="https://..." className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:bg-slate-700 rounded-lg">取消</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
