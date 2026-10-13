'use client';
import { useState } from 'react';
import { Save, X } from 'lucide-react';
import type { ActivityEventParsed } from '@/lib/db';
import { EVENT_TYPES } from '@/lib/events-ui';
export const newEvent = (): ActivityEventParsed => ({ event_name: '', event_date: new Date().toISOString().slice(0, 10), event_type: 'conference', participants: 0, registrations: 0, online_viewers: 0, collected_data: {} });
export function EventForm({ initial, onSaved, onCancel }: { initial: ActivityEventParsed; onSaved: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const style = 'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200';
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/events', { method: draft.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      if (!res.ok) throw new Error('保存活动失败，请重试');
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); } finally { setSaving(false); }
  }
  return <form onSubmit={save} className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-100">{draft.id ? '编辑活动' : '新增活动'}</h2><button type="button" onClick={onCancel} aria-label="关闭编辑" title="关闭编辑" className="p-2 text-slate-400"><X size={18} /></button></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {([{ key: 'event_name', label: '活动名称', required: true }, { key: 'event_date', label: '活动日期', type: 'date', required: true }, { key: 'location', label: '地点' }, { key: 'venue', label: '场馆 / 平台' }, { key: 'participants', label: '参与人数', type: 'number' }, { key: 'registrations', label: '报名人数', type: 'number' }, { key: 'online_viewers', label: '线上观看', type: 'number' }, { key: 'url', label: '官网原文', type: 'url' }] as const).map(field => <label key={field.key} className="space-y-1 text-sm text-slate-300"><span>{field.label}</span><input className={style} type={'type' in field ? field.type : 'text'} required={'required' in field && field.required} min={'type' in field && field.type === 'number' ? 0 : undefined} value={draft[field.key] ?? ''} onChange={e => setDraft({ ...draft, [field.key]: 'type' in field && field.type === 'number' ? Number(e.target.value) : e.target.value })} /></label>)}
      <label className="space-y-1 text-sm text-slate-300"><span>活动类型</span><select className={style} value={draft.event_type} onChange={e => setDraft({ ...draft, event_type: e.target.value })}>{EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
    </div>
    <label className="block space-y-1 text-sm text-slate-300"><span>活动描述</span><textarea className={style} rows={3} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"><Save size={16} />{saving ? '保存中…' : '保存活动'}</button>
  </form>;
}
