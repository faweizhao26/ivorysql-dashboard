'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { useAuth } from '@/app/auth-provider';
import { StatCard } from '@/components/StatCard';
import { EventCard } from '@/components/events/EventCard';
import { EventFilters } from '@/components/events/EventFilters';
import { EventForm, newEvent } from '@/components/events/EventForm';
import { buildEventQuery, type EventFiltersValue } from '@/lib/events-ui';
import type { ActivityEventListItem, ActivityEventParsed, ActivityEventTotals } from '@/lib/db';
import { downloadCSV } from '@/lib/csv-utils';
interface EventList { items: ActivityEventListItem[]; total: number; facets: { years: string[] }; totals: ActivityEventTotals }
export default function EventsPage() {
  const { accessLevel } = useAuth();
  const isAdmin = accessLevel === 'admin';
  const [filters, setFilters] = useState<EventFiltersValue>({ year: '', type: '', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EventList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ActivityEventParsed | null>(null);
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(`/api/events?${buildEventQuery(filters, page)}`, { signal: controller.signal });
        if (!res.ok) throw new Error('活动加载失败');
        setData(await res.json());
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '活动加载失败'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, page, version]);
  async function remove(event: ActivityEventListItem) {
    if (!confirm(`删除“${event.event_name}”及其资料链接？`)) return;
    try {
      const res = await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setPage(1); setVersion(v => v + 1);
    } catch { setError('删除失败，请重试'); }
  }
  async function exportEvents() {
    setExporting(true); setError('');
    try {
      const rows: ActivityEventListItem[] = [];
      for (let current = 1; ; current++) {
        const params = buildEventQuery(filters, current); params.set('pageSize', '100');
        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) throw new Error('导出失败');
        const result: EventList = await res.json(); rows.push(...result.items);
        if (rows.length >= result.total || !result.items.length) break;
      }
      downloadCSV(rows.map(e => ({ 名称: e.event_name, 日期: e.event_date, 类型: e.event_type, 地点: e.location || '', 场馆: e.venue || '', 报名人数: e.registrations, 参与人数: e.participants, 线上观看: e.online_viewers, 描述: e.description || '', 链接: e.url || '' })), 'ivorysql-events');
    } catch { setError('导出失败，请重试'); } finally { setExporting(false); }
  }
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 12));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-slate-100">社区活动</h1><div className="flex gap-2">
      <button title="导出筛选结果" disabled={exporting} onClick={exportEvents} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"><Download size={16} />{exporting ? '导出中…' : '导出 CSV'}</button>
      {isAdmin && <button onClick={() => setEditing(newEvent())} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"><Plus size={16} />新增活动</button>}
    </div></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title="活动数" value={data?.totals.events || 0} /><StatCard title="参与人数" value={data?.totals.participants || 0} /><StatCard title="报名人数" value={data?.totals.registrations || 0} /><StatCard title="线上观看" value={data?.totals.online_viewers || 0} /></div>
    <EventFilters value={filters} years={data?.facets.years || []} onChange={value => { setFilters(value); setPage(1); }} />
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {loading ? <p className="py-12 text-center text-slate-400">加载中…</p> : data?.items.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{data.items.map(event => <EventCard key={event.id} event={event} onEdit={isAdmin ? setEditing : undefined} onDelete={isAdmin ? remove : undefined} />)}</div> : !error && <p className="py-12 text-center text-slate-400">没有符合条件的活动</p>}
    <nav aria-label="活动分页" className="flex items-center justify-center gap-4 text-sm text-slate-400"><button aria-label="上一页" title="上一页" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-slate-600 p-2 disabled:opacity-30"><ChevronLeft size={18} /></button><span className="tabular-nums">{page} / {pages} · 共 {data?.total || 0} 项</span><button aria-label="下一页" title="下一页" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-slate-600 p-2 disabled:opacity-30"><ChevronRight size={18} /></button></nav>
    {isAdmin && editing && <div role="dialog" aria-modal="true" aria-label="编辑活动" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-5"><EventForm key={editing.id || 'new'} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setVersion(v => v + 1); }} /></div></div>}
  </div>;
}
