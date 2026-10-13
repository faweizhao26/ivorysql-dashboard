'use client';
import Link from 'next/link';
import { ArrowRight, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { ActivityEventListItem } from '@/lib/db';
import { describeMaterials, EVENT_TYPES } from '@/lib/events-ui';
export function EventCard({ event, onEdit, onDelete }: {
  event: ActivityEventListItem; onEdit?: (event: ActivityEventListItem) => void; onDelete?: (event: ActivityEventListItem) => void;
}) {
  return <article className="flex h-full min-w-0 flex-col rounded-lg border border-slate-700 bg-slate-800/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>{event.event_date.slice(0, 10)}</span><span className="text-emerald-300">{EVENT_TYPES.find(t => t.value === event.event_type)?.label || '其他'}</span></div>
    <h2 className="my-3 break-words text-lg font-semibold text-slate-100"><Link href={`/events/${event.id}`} className="hover:text-emerald-300">{event.event_name}</Link></h2>
    {event.description && <p className="mb-3 line-clamp-2 text-sm text-slate-400">{event.description}</p>}
    <p className="flex items-start gap-2 text-sm text-slate-400"><MapPin size={16} className="mt-0.5 shrink-0" />{[event.location, event.venue].filter(Boolean).join(' · ') || '地点未记录'}</p>
    <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-700 pt-3 text-sm">{[['参与', event.participants], ['报名', event.registrations], ['线上观看', event.online_viewers]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 tabular-nums text-slate-200">{Number(value).toLocaleString()}</dd></div>)}</dl>
    <p className="mb-3 mt-4 break-words text-xs text-slate-400">{describeMaterials(event.material_counts)}</p>
    <div className="mt-auto flex items-center justify-between gap-2"><Link href={`/events/${event.id}`} className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200">活动资料<ArrowRight size={16} /></Link><div className="flex gap-1">
      {onEdit && <button title="编辑活动" aria-label="编辑活动" onClick={() => onEdit(event)} className="p-2 text-slate-400 hover:text-slate-100"><Pencil size={16} /></button>}
      {onDelete && <button title="删除活动" aria-label="删除活动" onClick={() => onDelete(event)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>}
    </div></div>
  </article>;
}
