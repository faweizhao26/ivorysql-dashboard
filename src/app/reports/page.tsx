'use client';

import { useEffect, useState } from 'react';
import { Clipboard, Download, FileCheck, RefreshCw, Save } from 'lucide-react';
import { getBeijingDate } from '@/lib/date';
import { reportText } from '@/lib/operations-report';
import { ReportAppendix } from '@/components/ReportAppendix';
import type { ReportKind } from '@/lib/report-period';
import type { StoredReport } from '@/lib/operations-report-store';

const kinds = [['month', '月报'], ['quarter', '季报'], ['year', '年报']] as const;

export default function ReportsPage() {
  const today = getBeijingDate();
  const currentYear = Number(today.slice(0,4)), currentMonth = Number(today.slice(5,7));
  const [kind, setKind] = useState<ReportKind>('month');
  const [year, setYear] = useState(currentYear);
  const [index, setIndex] = useState(currentMonth);
  const limit = year < currentYear ? (kind === 'month' ? 12 : 4) : (kind === 'month' ? currentMonth : Math.ceil(currentMonth / 3));
  const part = Math.min(index, limit);
  const key = kind === 'year' ? String(year) : kind === 'quarter' ? `${year}-Q${part}` : `${year}-${String(part).padStart(2,'0')}`;
  const [response, setResponse] = useState<StoredReport | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reports?' + new URLSearchParams({ kind, key }), { cache: 'no-store', signal: controller.signal })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || '报告加载失败');
        if (!controller.signal.aborted) setResponse(body);
      })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '报告加载失败'); });
    return () => controller.abort();
  }, [kind,key,reload]);

  const report = response?.document.period.kind === kind && response.document.period.key === key ? response : null;
  function reset() { setError(''); setNotice(''); setResponse(null); }
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : '操作未完成，请重试'); }
    finally { setBusy(false); }
  }
  async function save(action: 'generate' | 'finalize') {
    const r = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, key, action, revision: report?.revision }),
    });
    const saved = await r.json();
    if (!r.ok) throw new Error(saved.error);
    setResponse(saved);
    setNotice(action === 'finalize' ? '已定稿' : saved.finalized_at ? '这份报告已定稿' : '草稿已保存');
  }

  return <div className="event-workspace">
    <header className="event-heading"><h1>运营报告</h1></header>
    <nav aria-label="报告类型" className="event-tabs">
      {kinds.map(([value,label]) => <button type="button" key={value} aria-pressed={kind === value} disabled={busy}
        onClick={() => { if (kind !== value) { reset(); setKind(value); setIndex(value === 'quarter' ? Math.ceil(currentMonth / 3) : currentMonth); } }}>{label}</button>)}
    </nav>
    <div className="event-toolbar">
      <div className="event-inline">
        <select aria-label="报告年份" value={year} disabled={busy} onChange={e => { reset(); setYear(Number(e.target.value)); }}>
          {Array.from({ length: Math.max(1,currentYear - 2021) }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
        {kind !== 'year' && <select aria-label={kind === 'month' ? '报告月份' : '报告季度'} value={part} disabled={busy} onChange={e => { reset(); setIndex(Number(e.target.value)); }}>
          {Array.from({ length: limit }, (_, i) => i + 1).map(i => <option key={i} value={i}>{kind === 'month' ? `${i} 月` : `第 ${i} 季度`}</option>)}
        </select>}
      </div>
      {report && <div className="event-inline">
        {!report.finalized_at && <button className="event-button" disabled={busy} onClick={() => void run(() => save('generate'))}>
          {report.revision ? <RefreshCw size={16} /> : <Save size={16} />}{report.revision ? '重新生成草稿' : '保存草稿'}
        </button>}
        {report.revision && !report.finalized_at && <button className="event-button event-primary" disabled={busy}
          onClick={() => { if (confirm('定稿后将保留当前报告及数据，不随看板更新。确定定稿？')) void run(() => save('finalize')); }}><FileCheck size={16} />定稿</button>}
        <button className="event-button" disabled={busy} onClick={() => void run(async () => {
          await navigator.clipboard.writeText(reportText(report.document)); setNotice('正文已复制');
        })}><Clipboard size={16} />复制正文</button>
        <button className="event-button" disabled={busy} onClick={() => void run(async () => {
          const { reportWord } = await import('@/lib/report-word');
          const url = URL.createObjectURL(await reportWord(report.document));
          const a = document.createElement('a'); a.href = url; a.download = `IvorySQL 运营报告 ${key}.docx`;
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
        })}><Download size={16} />导出 Word</button>
      </div>}
    </div>
    {error && <p role="alert" className="event-error">{error} <button onClick={() => { reset(); setReload(n => n + 1); }}>重新加载</button></p>}
    {notice && <p role="status">{notice}</p>}
    {!report && !error && <p className="event-empty" role="status">正在汇总报告…</p>}
    {report && <article className="min-w-0 break-words">
      <header>
        <h2 className="text-xl font-semibold">{report.document.period.label}社区运营{kind === 'month' ? '月报' : kind === 'quarter' ? '季报' : '年报'}</h2>
        <small>{report.document.period.start} 至 {report.document.period.end}{report.document.period.closed ? '' : ' · 周期未结束'} · {report.finalized_at ? '已定稿' : report.revision ? '草稿' : '预览'} · 生成于 {new Date(report.document.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</small>
      </header>
      <nav className="event-inline mt-4" aria-label="报告目录">
        <a href="#report-summary" className="event-text-button">运营摘要</a>
        {report.document.sections.map((section, i) =>
          <a key={section.title} href={`#report-section-${i}`} className="event-text-button px-1">{section.title}</a>)}
      </nav>
      <section className="event-band scroll-mt-24" id="report-summary"><h3>运营摘要</h3>{report.document.summary.map((item,i) => <p className="my-2" key={i}>{item}</p>)}</section>
      {report.document.sections.map((section, i) => <section className="event-band scroll-mt-24" id={`report-section-${i}`} key={section.title}>
        <h3>{section.title}</h3>
        <ul className="list-disc space-y-2 pl-5">{section.lines.map((row,i) => <li key={i}>
          {row.text}{row.links?.map(({label,url},j) => <a key={j} href={url} target="_blank" rel="noreferrer" className="event-text-button ml-2 underline">{label}</a>)}
        </li>)}</ul>
        {section.table && <div className="mt-3 max-w-full overflow-x-auto" role="region" aria-label={section.title + '明细'} tabIndex={0}>
          <table className="w-full min-w-[580px] border-collapse text-left text-sm tabular-nums" aria-label={section.title + '表'}>
            <thead><tr className="border-b border-slate-700 bg-slate-800/50">
              {section.table.columns.map((column, i) => <th key={column} scope="col" className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{column}</th>)}
            </tr></thead>
            <tbody>{section.table.rows.map(([label,...values], i) => <tr key={i} className="border-b border-slate-700/60">
              <th scope="row" className="px-3 py-2 font-medium">{label}</th>
              {values.map((value, j) => <td key={j} className="px-3 py-2 text-right">{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>}
        {!!section.appendix?.length && <ReportAppendix key={report.document.generatedAt} rows={section.appendix} title={section.title}/>}
      </section>)}
    </article>}
  </div>;
}
