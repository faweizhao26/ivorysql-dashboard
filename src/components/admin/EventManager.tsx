'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { ActivityEventListItem, ActivityEventParsed } from '@/lib/db';
import { buildEventQuery, describeMaterials } from '@/lib/events-ui';
import { EventForm, newEvent } from '@/components/events/EventForm';
import EventMaterialEditor from './EventMaterialEditor';

export default function EventManager() {
  const [items, setItems] = useState<ActivityEventListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ActivityEventParsed | null>(null);
  const [version, setVersion] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  const [materialDirty, setMaterialDirty] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/events?${buildEventQuery({ year: '', type: '', search }, page)}`, { signal: controller.signal }).then(async res => {
        if (!res.ok) throw new Error('活动加载失败');
        const result = await res.json(); setItems(result.items); setTotal(result.total);
      }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, version]);
  function choose(event: ActivityEventParsed | null) {
    if ((formDirty || materialDirty) && !confirm('放弃尚未保存的活动或资料修改？')) return;
    setSelected(event); setFormDirty(false); setMaterialDirty(false); setError('');
  }
  async function saved(id?: number) {
    setFormDirty(false); setVersion(v => v + 1);
    if (!id) return;
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) throw new Error('活动已保存，但刷新失败');
      setSelected((await res.json()).event);
    } catch { setError('活动已保存，请重新选择活动刷新'); }
  }
  async function remove() {
    if (!selected?.id || !confirm(`删除“${selected.event_name}”及其全部资料链接？`)) return;
    try {
      const res = await fetch(`/api/events?id=${selected.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setSelected(null); setPage(1); setVersion(v => v + 1);
    } catch { setError('删除活动失败'); }
  }
  async function sync() {
    setSyncing(true); setError('');
    try {
      const res = await fetch('/api/events/sync', { method: 'POST' });
      if (!res.ok) throw new Error('官网活动同步失败，请查看同步状态');
      setVersion(v => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : '同步失败'); } finally { setSyncing(false); }
  }
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-100">活动管理 <span className="text-sm font-normal text-slate-400">{total}</span></h2><div className="flex gap-3"><button disabled={syncing} onClick={sync} className="inline-flex items-center gap-2 text-sm text-slate-300 disabled:opacity-50"><RefreshCw size={16} />{syncing ? '同步中…' : '同步官网'}</button><button onClick={() => choose(newEvent())} className="inline-flex items-center gap-2 text-sm text-emerald-300"><Plus size={16} />新增活动</button></div></header>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <aside className="min-w-0 space-y-3"><input aria-label="搜索后台活动" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="搜索活动" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm" />
        <ul className="max-h-[65vh] overflow-y-auto divide-y divide-slate-700">{items.map(event => <li key={event.id}><button onClick={() => choose(event)} aria-pressed={selected?.id === event.id} className={`w-full p-3 text-left ${selected?.id === event.id ? 'border-l-2 border-emerald-400 bg-emerald-500/10' : 'hover:bg-slate-700/30'}`}><span className="block text-xs text-slate-400">{event.event_date.slice(0, 10)}</span><span className="my-1 block break-words text-sm text-slate-200">{event.event_name}</span><span className="block text-xs text-slate-500">{describeMaterials(event.material_counts)}</span></button></li>)}</ul>
        <nav className="flex items-center justify-between text-xs text-slate-400"><button title="上一页" aria-label="上一页" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 disabled:opacity-30"><ChevronLeft size={16} /></button>{page} / {Math.max(1, Math.ceil(total / 12))}<button title="下一页" aria-label="下一页" disabled={page * 12 >= total} onClick={() => setPage(p => p + 1)} className="p-2 disabled:opacity-30"><ChevronRight size={16} /></button></nav>
      </aside>
      <div className="min-w-0 space-y-6 lg:border-l lg:border-slate-700 lg:pl-6">{selected ? <><EventForm key={selected.id || 'new'} initial={selected} onSaved={saved} onCancel={() => choose(null)} onDirtyChange={setFormDirty} />
        {selected.id && <><div className="flex items-center justify-between"><Link href={`/events/${selected.id}`} className="text-sm text-emerald-300">查看活动详情</Link><button onClick={remove} className="inline-flex items-center gap-2 text-sm text-red-400"><Trash2 size={16} />删除活动</button></div><EventMaterialEditor key={selected.id} eventId={selected.id} onDirtyChange={setMaterialDirty} /></>}
      </> : <p className="py-12 text-center text-sm text-slate-400">未选择活动</p>}</div>
    </div>
  </div>;
}
