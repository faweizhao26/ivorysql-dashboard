'use client';

import { useEffect, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, FilePlus2 } from 'lucide-react';
import { publicationChannels, type PublicationPlan } from '@/lib/publication';
import { getBeijingDate } from '@/lib/date';

const endpoint = '/api/content/calendar';
const blank = (): PublicationPlan => ({ id: 0, title: '', planned_date: null, channels: ['wechat', 'official'] });
const options = publicationChannels.map(p => <option key={p.key} value={p.key}>{p.name}</option>);
async function request(method = 'GET', body?: object, search = '') {
  const r = await fetch(endpoint + search, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '请求失败');
  return data;
}
export function PublicationCalendar() {
  const today = getBeijingDate();
  const [month, setMonth] = useState(today.slice(0,7)), [plans, setPlans] = useState<PublicationPlan[]>([]);
  const [mode, setMode] = useState<'calendar'|'edit'|'register'>('calendar');
  const [draft, setDraft] = useState(blank), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [loaded, setLoaded] = useState(false), [reload, setReload] = useState(0);
  const [receipt, setReceipt] = useState(''), [platform, setPlatform] = useState('wechat'), [title, setTitle] = useState('');
  const [allYears, setAllYears] = useState(false);
  const [exporting, setExporting] = useState(false);
  async function downloadCsv() {
    if (exporting) return;
    const sheet = mode === 'register' ? 'actual' : 'plan';
    const scope = allYears ? '历年' : month.slice(0,4);
    const params = new URLSearchParams({sheet});
    if (!allYears) params.set('year',scope);
    setExporting(true);setError('');
    try {
      const res = await fetch(endpoint+'/export?'+params, {cache:'no-store'});
      if (!res.ok || !res.headers.get('content-type')?.startsWith('text/csv')) throw new Error('导出失败，请检查登录状态后重试');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href=url; a.download=scope+' IvorySQL 内容'+(sheet==='plan'?'发布排期':'实际发布')+'.csv';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
    } catch(e) { setError(e instanceof Error ? e.message : '导出失败'); }
    finally { setExporting(false); }
  }
  useEffect(() => {
    let live = true;
    request().then(rows => { if (live) { setPlans(rows); setLoaded(true); } })
      .catch(() => { if(live) setError('排期加载失败，请重试'); });
    return () => { live=false; };
  }, [reload]);
  const first = parseISO(month+'-01');
  const days = eachDayOfInterval({start:startOfWeek(first,{weekStartsOn:1}),end:endOfWeek(endOfMonth(first),{weekStartsOn:1})});
  const monthly = plans.filter(p=>p.planned_date?.startsWith(month));
  function change(next: typeof mode) { setMode(next); setError(''); setReceipt(''); }
  function edit(p: PublicationPlan) { setDraft(p); change('edit'); }
  function entry(p: PublicationPlan) {
    return <button key={p.id} className="event-calendar-item block w-full text-left" onClick={()=>edit(p)}>{p.title}<small>{p.channels.length===publicationChannels.length?'全渠道':publicationChannels.filter(c=>p.channels.includes(c.key)).map(c=>c.name).join(' · ')}</small></button>;
  }
  async function save(work: ()=>Promise<void>) {
    setBusy(true);setError('');setReceipt('');
    try { await work(); } catch(e) { setError(e instanceof Error?e.message:'保存失败'); } finally {setBusy(false);}
  }
  function refresh() { setLoaded(false);setReload(i=>i+1); }
  return <section className="event-workspace">
    <header className="event-heading"><h1>{mode==='register'?'发布登记':mode==='edit'?(draft.id?'编辑排期':'新增排期'):'内容发布日历'}</h1>
      <div className="event-inline">{mode!=='edit' && <>
        <select aria-label="导出范围" value={allYears?'all':'year'} onChange={e=>setAllYears(e.target.value==='all')}>
          <option value="year">{month.slice(0,4)} 年</option><option value="all">{mode==='calendar'?'全部年份（含待排期）':'全部年份'}</option>
        </select>
        <button type="button" className="event-button" disabled={exporting} onClick={downloadCsv}><Download size={16}/>{exporting?'导出中…':mode==='register'?'导出实际发布 CSV':'导出排期 CSV'}</button>
      </>}{mode==='calendar'?<>
        <button className="event-button" onClick={()=>{setTitle('');setPlatform('wechat');change('register');}}><FilePlus2 size={16}/>发布登记</button>
        <button className="event-button event-primary" onClick={()=>edit(blank())}><CalendarPlus size={16}/>新增排期</button>
      </>:<button className="event-button" disabled={busy} onClick={()=>change('calendar')}>返回日历</button>}</div>
    </header>
    {error && <p role="alert" className="event-error">{error} {!loaded && <button onClick={()=>{setError('');refresh();}}>重试</button>}</p>}
    {mode==='calendar' && <>
      <div className="event-toolbar"><div className="event-inline"><button className="event-icon" aria-label="上个月" onClick={()=>setMonth(format(addMonths(first,-1),'yyyy-MM'))}><ChevronLeft/></button><h2>{format(first,'yyyy 年 M 月')}</h2><button className="event-icon" aria-label="下个月" onClick={()=>setMonth(format(addMonths(first,1),'yyyy-MM'))}><ChevronRight/></button></div><small>{loaded?'本月计划 '+monthly.length+' 篇':'加载中…'}</small></div>
      <div className="event-month-calendar"><div className="event-week">{Array.from('一二三四五六日',s=><span key={s}>周{s}</span>)}</div><div className="event-month-grid">{days.map(day=>{const d=format(day,'yyyy-MM-dd');return <div key={d} className={'event-day '+(d.startsWith(month)?'':'event-outside')}><button className="event-day-number" aria-label={d+' 新增排期'} onClick={()=>edit({...blank(),planned_date:d})}>{day.getDate()}</button>{plans.filter(p=>p.planned_date===d).map(entry)}</div>;})}</div></div>
      <div className="event-mobile-agenda">{monthly.length ? [...monthly].reverse().map(p=><div key={p.id}><small>{p.planned_date}</small>{entry(p)}</div>):<p className="event-muted">本月暂无排期</p>}</div>
      <div className="event-band"><h3>待排期选题</h3>{plans.some(p=>!p.planned_date)?plans.filter(p=>!p.planned_date).map(entry):<p className="event-muted">暂无待排期选题</p>}</div>
    </>}
    {mode==='edit' && <form onSubmit={e=>{e.preventDefault();void save(async()=>{await request('POST',{...draft,id:draft.id||null,action:'plan'});if(draft.planned_date)setMonth(draft.planned_date.slice(0,7));change('calendar');refresh();});}}>
      <fieldset disabled={busy}><div className="event-fields"><label className="event-field">选题标题<input required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label className="event-field">计划日期（可留空）<input type="date" value={draft.planned_date||''} onChange={e=>setDraft({...draft,planned_date:e.target.value||null})}/></label></div>
      <h3>计划发布渠道</h3><div className="event-inline"><button type="button" className="event-button" onClick={()=>setDraft({...draft,channels:blank().channels})}>仅主渠道</button><button type="button" className="event-button" onClick={()=>setDraft({...draft,channels:publicationChannels.map(c=>c.key)})}>全渠道</button></div>
      <div className="event-inline">{publicationChannels.map(c=><label className="event-check" key={c.key}><input type="checkbox" checked={draft.channels.includes(c.key)} onChange={e=>setDraft({...draft,channels:e.target.checked?[...draft.channels,c.key]:draft.channels.filter(k=>k!==c.key)})}/>{c.name}</label>)}</div>
      <div className="event-inline"><button className="event-button event-primary" disabled={!draft.channels.length}>保存排期</button>{!!draft.id && <button className="event-button" type="button" onClick={()=>{if(confirm('取消此排期？已发布的文章不受影响。'))void save(async()=>{await request('DELETE',undefined,'?id='+draft.id);change('calendar');refresh();});}}>取消排期</button>}</div></fieldset>
    </form>}
    {mode==='register' && <form onSubmit={e=>{e.preventDefault();const form=e.currentTarget, fields=new FormData(form);void save(async()=>{await request('POST',{action:'register',planId:fields.get('planId')||null,date:fields.get('date'),title,url:fields.get('url'),platform});setReceipt(platform);form.reset();setTitle('');});}}>
      <fieldset disabled={busy}><div className="event-fields">
        <label className="event-field">关联排期（可选）<select name="planId" onChange={e=>{const p=plans.find(p=>p.id===Number(e.target.value));if(p){setTitle(p.title);setPlatform(p.channels[0]);}}}><option value="">独立登记</option>{plans.map(p=><option key={p.id} value={p.id}>{p.planned_date||'待排期'} · {p.title}</option>)}</select></label>
        <label className="event-field">实际发布渠道<select value={platform} onChange={e=>setPlatform(e.target.value)}>{options}</select></label>
        <label className="event-field">实际文章标题<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label className="event-field">实际发布日期<input name="date" type="date" defaultValue={today} max={today} required/></label>
        <label className="event-field event-full">文章链接<input name="url" type="url" placeholder="https://" required/></label>
      </div><button className="event-button event-primary">保存发布记录</button></fieldset>
      {receipt && <p role="status">已登记，阅读量待补录。 <a className="event-text-button" href={'/content?platform='+receipt}>查看该渠道文章</a></p>}
    </form>}
  </section>;
}
