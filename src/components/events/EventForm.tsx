'use client';
import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import type { ActivityEventParsed } from '@/lib/db';
import { EVENT_TYPES } from '@/lib/events-ui';
import { defaultWorkspace, DEFAULT_TASK_TEMPLATES, EVENT_STAGES, readWorkspace, eventProgress, type EventWorkspace } from '@/lib/event-workspace';
import { getBeijingDate } from '@/lib/date';
import EventMaterialEditor from '@/components/admin/EventMaterialEditor';

export const newEvent = (): ActivityEventParsed => ({ event_name: '', event_date: '', event_type: 'meetup', participants: 0, registrations: 0, online_viewers: 0, collected_data: { workspace: defaultWorkspace() } });
export function EventForm({ initial, onSaved, onCancel, onDirtyChange }: { initial: ActivityEventParsed; onSaved: (id?: number) => void; onCancel: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState(initial), [workspace, setWorkspace] = useState(() => readWorkspace(initial));
  const [tab, setTab] = useState('basic'), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [datePending, setDatePending] = useState(!initial.event_date);
  const [templates, setTemplates] = useState(DEFAULT_TASK_TEMPLATES), [templateKey, setTemplateKey] = useState('meetup'), [templateText, setTemplateText] = useState<string | null>(null);
  const [newTask, setNewTask] = useState(''), [materialDirty, setMaterialDirty] = useState(false), [templateBusy, setTemplateBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || JSON.stringify(workspace) !== JSON.stringify(readWorkspace(initial));
  useEffect(() => { onDirtyChange?.(dirty || materialDirty || templateText !== null); return () => onDirtyChange?.(false); }, [dirty, materialDirty, templateText, onDirtyChange]);
  useEffect(() => { const controller = new AbortController(); fetch('/api/events/templates', { signal: controller.signal }).then(async res => { if (!res.ok) throw new Error('任务模板加载失败'); setTemplates((await res.json()).templates); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }); return () => controller.abort(); }, []);
  const update = <K extends keyof EventWorkspace>(key: K, value: EventWorkspace[K]) => setWorkspace(w => ({ ...w, [key]: value }));
  const metric = (value: string) => value === '' ? null : Number(value);
  const field = (key: keyof ActivityEventParsed, label: string, type = 'text') => <label className="event-field" key={key}>{label}<input type={type} min={type === 'number' ? 0 : undefined} value={String(draft[key] ?? '')} onChange={e => setDraft(d => ({ ...d, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} /></label>;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/events', { method: draft.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, collected_data: { ...draft.collected_data, workspace } }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || '保存活动失败');
      onSaved(draft.id || result.eventId);
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); } finally { setSaving(false); }
  }
  async function saveTemplate() {
    setTemplateBusy(true); setError('');
    try { const tasks = (templateText ?? templates[templateKey].join('\n')).split('\n').map(s => s.trim()).filter(Boolean); const res = await fetch('/api/events/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: templateKey, tasks }) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); setTemplates(t => ({ ...t, [templateKey]: tasks })); setTemplateText(null); }
    catch (err) { setError(err instanceof Error ? err.message : '模板保存失败'); } finally { setTemplateBusy(false); }
  }
  return <div className="event-editor">
    <header className="event-editor-header"><div><h2>{draft.id ? draft.event_name : '新增活动计划'}</h2><small>{EVENT_STAGES[workspace.status]} · {draft.event_date || workspace.month || '未排期'}</small></div><button type="button" className="event-icon" title="关闭编辑" aria-label="关闭编辑" onClick={onCancel}><X size={19} /></button></header>
    <div className="event-tabs" role="tablist" aria-label="活动编辑内容">{[['basic', '基本信息'], ['tasks', '筹备任务'], ['promotion', '宣传与成果'], ['materials', '活动资料']].map(([key, title]) => <button key={key} id={`event-edit-${key}`} role="tab" aria-controls="event-edit-panel" aria-selected={tab === key} onClick={() => { if (materialDirty && !confirm('放弃尚未保存的资料修改？')) return; setTab(key); setMaterialDirty(false); }} type="button">{title}</button>)}</div>
    {error && <p role="alert" className="event-error">{error}</p>}
    <div id="event-edit-panel" role="tabpanel" aria-labelledby={`event-edit-${tab}`}>
    {tab === 'materials' ? draft.id ? <EventMaterialEditor eventId={draft.id} onDirtyChange={setMaterialDirty} /> : <p className="event-empty">保存活动后可添加网盘资料</p> : <form onSubmit={save}>
      {tab === 'basic' && <>
        <div className="event-fields"><label className="event-field event-full">活动名称<input required maxLength={300} value={draft.event_name} onChange={e => setDraft(d => ({ ...d, event_name: e.target.value }))} /></label>
          <label className="event-field">活动类别<select value={draft.event_type} onChange={e => setDraft(d => ({ ...d, event_type: e.target.value }))}>{EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label className="event-field">筹备阶段<select value={workspace.status} onChange={e => update('status', e.target.value as EventWorkspace['status'])}>{Object.entries(EVENT_STAGES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          <label className="event-field">活动形式<select value={workspace.format} onChange={e => update('format', e.target.value)}><option value="">未设置</option>{['线上', '线下', '混合'].map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="event-field">主办／参与<select value={workspace.role} onChange={e => update('role', e.target.value)}><option value="">未设置</option>{['主办', '参与', '协办'].map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="event-field">计划月份<input type="month" value={workspace.month} onChange={e => update('month', e.target.value)} /></label>
          <label className="event-field">负责人<input value={workspace.owner} onChange={e => update('owner', e.target.value)} /></label>
        </div>
        <label className="event-check"><input type="checkbox" checked={datePending} onChange={e => { setDatePending(e.target.checked); if (e.target.checked) { setDraft(d => ({ ...d, event_date: '' })); update('end_date', ''); } }} />日期待定</label>
        <div className="event-fields">{!datePending && <><label className="event-field">开始日期<input type="date" required value={draft.event_date} onChange={e => setDraft(d => ({ ...d, event_date: e.target.value }))} /></label><label className="event-field">结束日期<input type="date" min={draft.event_date} value={workspace.end_date} onChange={e => update('end_date', e.target.value)} /></label></>}
          {field('location', '城市／地区')}{field('venue', '场馆／平台')}
          <label className="event-field">参与方式<input value={workspace.participation} onChange={e => update('participation', e.target.value)} placeholder="演讲、展台、线上征文等" /></label>
          <label className="event-field">系列活动<input value={workspace.series} onChange={e => update('series', e.target.value)} /></label>
          <label className="event-field event-full">合作伙伴<input value={workspace.partners.join('、')} onChange={e => update('partners', e.target.value.split(/[、,，]/))} /></label>
          <label className="event-field">预计参与人数<input type="number" min="0" value={workspace.target_participants ?? ''} onChange={e => update('target_participants', metric(e.target.value))} /></label>
          <label className="event-field">可见范围<select value={workspace.visibility} onChange={e => update('visibility', e.target.value as 'public' | 'internal')}><option value="internal">内部，仅管理员</option><option value="public">普通查看账号可见</option></select></label>
          {field('url', '官网／报名链接', 'url')}
          <label className="event-field">实际举办日期<input type="date" value={workspace.actual_date} onChange={e => update('actual_date', e.target.value)} /></label>
          <label className="event-field event-full">活动描述<textarea rows={3} value={draft.description || ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} /></label>
          <label className="event-field event-full">内部备注<textarea rows={2} value={workspace.notes} onChange={e => update('notes', e.target.value)} /></label>
        </div>
        {!!workspace.schedule_history.length && <details className="event-history"><summary>排期调整记录 · 原计划 {workspace.original_month || '未排期'}</summary>{workspace.schedule_history.map((h, i) => <p key={i}>{h.from || '未排期'} → {h.to || '未排期'} · {h.changed_at.slice(0, 10)}</p>)}</details>}
      </>}
      {tab === 'tasks' && <>
        <div className="event-progress-label"><span>筹备进度</span><strong>{eventProgress(workspace)}% · {workspace.tasks.filter(t => t.done).length}/{workspace.tasks.length}</strong></div><progress aria-label="筹备进度" max="100" value={eventProgress(workspace)} />
        {workspace.tasks.map(task => <div className="event-task" key={task.id}><label className="event-check"><input type="checkbox" checked={task.done} onChange={e => update('tasks', workspace.tasks.map(t => t.id === task.id ? { ...t, done: e.target.checked } : t))} /><span className={task.done ? 'event-done' : ''}>{task.title}</span></label><div className="event-task-fields"><input aria-label={`${task.title}名称`} value={task.title} onChange={e => update('tasks', workspace.tasks.map(t => t.id === task.id ? { ...t, title: e.target.value } : t))} /><input aria-label={`${task.title}负责人`} placeholder="负责人" value={task.owner} onChange={e => update('tasks', workspace.tasks.map(t => t.id === task.id ? { ...t, owner: e.target.value } : t))} /><input aria-label={`${task.title}截止日期`} type="date" value={task.due} onChange={e => update('tasks', workspace.tasks.map(t => t.id === task.id ? { ...t, due: e.target.value } : t))} /><button className="event-icon" type="button" title="删除任务" aria-label={`删除任务 ${task.title}`} onClick={() => update('tasks', workspace.tasks.filter(t => t.id !== task.id))}><Trash2 size={15} /></button></div>{!task.done && task.due && task.due < getBeijingDate() && !['completed', 'cancelled'].includes(workspace.status) && <span className="event-error">已逾期</span>}</div>)}
        <div className="event-inline"><input aria-label="新任务名称" placeholder="添加筹备任务" value={newTask} onChange={e => setNewTask(e.target.value)} /><button type="button" className="event-button" disabled={!newTask.trim()} onClick={() => { update('tasks', [...workspace.tasks, { id: crypto.randomUUID(), title: newTask.trim(), owner: workspace.owner, due: '', done: false }]); setNewTask(''); }}><Plus size={16} />添加</button></div>
        <details className="event-history"><summary>任务模板</summary><div className="event-inline"><select aria-label="任务模板类型" value={templateKey} onChange={e => { setTemplateKey(e.target.value); setTemplateText(null); }}>{Object.keys(templates).map(key => <option key={key} value={key}>{EVENT_TYPES.find(t => t.value === key)?.label || key}</option>)}</select><button type="button" className="event-button" onClick={() => update('tasks', [...workspace.tasks, ...templates[templateKey].filter(title => !workspace.tasks.some(t => t.title === title)).map(title => ({ id: crypto.randomUUID(), title, owner: workspace.owner, due: '', done: false }))])}>套用模板</button></div><label className="event-field">默认任务，每行一项<textarea rows={6} value={templateText ?? templates[templateKey].join('\n')} onChange={e => setTemplateText(e.target.value)} /></label><button type="button" className="event-button" disabled={templateBusy || templateText === null} onClick={saveTemplate}><Save size={15} />保存模板</button></details>
      </>}
      {tab === 'promotion' && <>
        <div className="event-fields">{field('participants', '实际参与人数', 'number')}{field('registrations', '实际报名人数', 'number')}{field('online_viewers', '线上观看量', 'number')}
          <label className="event-field">覆盖人数<input placeholder="例如 200+" value={workspace.coverage} onChange={e => update('coverage', e.target.value)} /></label>
          <label className="event-field">覆盖统计范围<input placeholder="大会总覆盖、IvorySQL 场次等" value={workspace.coverage_scope} onChange={e => update('coverage_scope', e.target.value)} /></label>
          <label className="event-field">目标留资数量<input type="number" min="0" value={workspace.target_leads ?? ''} onChange={e => update('target_leads', metric(e.target.value))} /></label>
          <label className="event-field">实际留资数量<input type="number" min="0" value={workspace.leads ?? ''} onChange={e => update('leads', metric(e.target.value))} /></label>
        </div>
        <h3>宣传文章</h3>{workspace.promotions.map(p => <section className="event-promotion" key={p.id}><div className="event-fields"><label className="event-field">用途<select value={p.kind} onChange={e => update('promotions', workspace.promotions.map(x => x.id === p.id ? { ...x, kind: e.target.value as 'preview' | 'recap' } : x))}><option value="preview">活动预告</option><option value="recap">活动总结</option></select></label>{(['title', 'platform', 'url'] as const).map(key => <label className={`event-field ${key === 'url' ? 'event-full' : ''}`} key={key}>{{ title: '文章标题', platform: '渠道', url: '文章链接' }[key]}<input type={key === 'url' ? 'url' : 'text'} required={key === 'url'} value={p[key]} onChange={e => update('promotions', workspace.promotions.map(x => x.id === p.id ? { ...x, [key]: e.target.value, linked: false } : x))} /></label>)}<label className="event-field">阅读量<input type="number" min="0" value={p.views ?? ''} onChange={e => update('promotions', workspace.promotions.map(x => x.id === p.id ? { ...x, views: metric(e.target.value), updated_at: new Date().toISOString() } : x))} /></label><label className="event-field">数据更新日期<input type="date" value={p.updated_at.slice(0, 10)} onChange={e => update('promotions', workspace.promotions.map(x => x.id === p.id ? { ...x, updated_at: e.target.value } : x))} /></label></div>{p.linked && <small>已关联内容页阅读数据</small>}<button type="button" className="event-icon" title="删除文章关联" aria-label={`删除文章关联 ${p.title || p.url}`} onClick={() => update('promotions', workspace.promotions.filter(x => x.id !== p.id))}><Trash2 size={16} /></button></section>)}
        <button type="button" className="event-button" onClick={() => update('promotions', [...workspace.promotions, { id: crypto.randomUUID(), kind: 'preview', title: '', platform: '', url: '', views: null, updated_at: '' }])}><Plus size={16} />关联文章</button>
      </>}
      <footer className="event-save"><button disabled={saving} type="submit" className="event-button event-primary"><Save size={16} />{saving ? '保存中…' : '保存活动'}</button><button type="button" onClick={onCancel} className="event-button">取消</button></footer>
    </form>}
    </div>
  </div>;
}
