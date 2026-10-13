'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { materialDraft, materialPayload } from '@/lib/material-draft';
import { MATERIAL_LABELS } from '@/lib/events-ui';
import type { ActivityMaterial, ActivityMaterialType } from '@/lib/material-validation';

export default function EventMaterialEditor({ eventId, onDirtyChange }: { eventId: number; onDirtyChange?: (dirty: boolean) => void }) {
  const [materials, setMaterials] = useState<ActivityMaterial[]>([]);
  const [draft, setDraft] = useState(materialDraft());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const editorRef = useRef<HTMLFormElement>(null);
  const style = 'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200';
  const base = `/api/events/${eventId}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(base, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('资料加载失败');
      setMaterials((await res.json()).materials || []); setError(''); setLoading(false);
    }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [base, version]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (open) editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [open, editingId]);
  const reset = useCallback(() => { setOpen(false); setEditingId(null); setDraft(materialDraft()); setDirty(false); }, []);
  function start(material?: ActivityMaterial) {
    if (dirty && !confirm('放弃尚未保存的资料修改？')) return;
    setDraft(material ? { material_type: material.material_type, title: material.title, url: material.url || '', thumbnail_url: material.thumbnail_url || '', access_note: material.access_note || '', source_url: material.source_url || '', sort_order: material.sort_order } : materialDraft());
    setEditingId(material?.id || null); setOpen(true); setDirty(false); setError('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    let payload;
    try { payload = materialPayload(eventId, draft); } catch { setError('请填写标题，并提供 HTTPS 链接或提取码 / 备注。排序必须为非负整数。'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${base}/materials${editingId ? `/${editingId}` : ''}`, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(res.status === 409 ? '此活动已存在相同链接，请编辑已有资料' : '保存资料失败，修改内容已保留');
      reset(); setVersion(v => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); } finally { setBusy(false); }
  }
  async function remove(material: ActivityMaterial) {
    if (!confirm(`删除资料“${material.title}”？`)) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/materials/${material.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除资料失败');
      if (editingId === material.id) reset(); setVersion(v => v + 1);
    } catch { setError('删除资料失败，请重试'); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-slate-700 pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-100">活动资料 <span className="text-sm font-normal text-slate-400">{materials.length}</span></h2><button disabled={loading || busy} onClick={() => start()} className="inline-flex items-center gap-2 text-sm text-emerald-300 disabled:opacity-50"><Plus size={16} />添加资料</button></div>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className={open ? 'grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2' : ''}>
    {loading ? <p className="text-sm text-slate-400">加载中…</p> : <ul className={`min-w-0 divide-y divide-slate-700 ${open ? 'order-2 max-h-[32rem] overflow-y-auto xl:order-1' : ''}`}>{materials.map(material => <li key={material.id} className="flex items-start gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm text-slate-200">{material.title}<span className="ml-2 text-xs text-slate-500">{MATERIAL_LABELS[material.material_type]}</span></p>{material.url && <a href={material.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs text-emerald-300">{material.url}</a>}{material.access_note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-400">{material.access_note}</p>}</div><button disabled={busy} title="编辑资料" aria-label="编辑资料" onClick={() => start(material)} className="p-2 text-slate-400"><Pencil size={16} /></button><button disabled={busy} title="删除资料" aria-label="删除资料" onClick={() => remove(material)} className="p-2 text-red-400"><Trash2 size={16} /></button></li>)}</ul>}
    {!loading && !materials.length && <p className="text-sm text-slate-400">暂未添加资料</p>}
    {open && <form ref={editorRef} onSubmit={save} className="order-1 min-w-0 scroll-mt-36 space-y-4 xl:order-2"><div className="flex items-center justify-between"><h3 className="font-medium text-slate-200">{editingId ? '编辑资料' : '新增资料'}</h3><button type="button" title="关闭资料编辑" aria-label="关闭资料编辑" onClick={() => { if (!dirty || confirm('放弃尚未保存的资料修改？')) reset(); }} className="p-2 text-slate-400"><X size={16} /></button></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1"><label className="space-y-1 text-sm text-slate-300"><span>类型</span><select className={style} value={draft.material_type} onChange={e => { setDraft({ ...draft, material_type: e.target.value as ActivityMaterialType }); setDirty(true); }}>{Object.entries(MATERIAL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {([{ key: 'title', label: '标题' }, { key: 'url', label: '网盘 / 资料链接' }, { key: 'thumbnail_url', label: '缩略图链接' }, { key: 'source_url', label: '资料来源链接' }] as const).map(field => <label key={field.key} className="space-y-1 text-sm text-slate-300"><span>{field.label}</span><input className={style} required={field.key === 'title'} type={field.key === 'title' ? 'text' : 'url'} value={draft[field.key]} onChange={e => { setDraft({ ...draft, [field.key]: e.target.value }); setDirty(true); }} /></label>)}
      <label className="space-y-1 text-sm text-slate-300"><span>排序</span><input type="number" min={0} step={1} className={style} value={draft.sort_order} onChange={e => { setDraft({ ...draft, sort_order: Number(e.target.value) }); setDirty(true); }} /></label></div>
      <label className="block space-y-1 text-sm text-slate-300"><span>提取码 / 备注 / 领取说明</span><textarea rows={3} className={style} value={draft.access_note} onChange={e => { setDraft({ ...draft, access_note: e.target.value }); setDirty(true); }} /></label>
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"><Save size={16} />{busy ? '保存中…' : '保存资料'}</button>
    </form>}
    </div>
  </section>;
}
