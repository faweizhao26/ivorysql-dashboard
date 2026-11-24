'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReportLine } from '@/lib/operations-report';

const pageSize = 20;

export function ReportAppendix({ rows, title }: { rows: ReportLine[]; title: string }) {
  const [find, setFind] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const tags = useMemo(() => [...new Set(rows.flatMap(row => row.tags ?? []))].sort((a,b) => a.localeCompare(b,'zh-CN')), [rows]);
  const term = find.trim().toLocaleLowerCase('zh-CN');
  const matched = rows.filter(row => (!tag || row.tags?.includes(tag)) && (!term || row.text.toLocaleLowerCase('zh-CN').includes(term)));
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const current = Math.min(page, pages);

  return <details className="mt-4 border-t border-slate-700/50 pt-3">
    <summary className="cursor-pointer font-semibold text-slate-200">查看全部明细（{rows.length} 条）</summary>
    <div className="event-inline my-3">
      <input className="w-56" type="search" placeholder="搜索明细" aria-label={title + '明细搜索'}
        value={find} onChange={e => { setFind(e.target.value); setPage(1); }} />
      {tags.length > 0 && <select aria-label={title + '明细筛选'} value={tag} onChange={e => { setTag(e.target.value); setPage(1); }}>
        <option value="">全部分类</option>
        {tags.map(t => <option key={t}>{t}</option>)}
      </select>}
      <span role="status" className="event-muted">{matched.length} 条</span>
    </div>
    {matched.length ? <ol className="divide-y divide-slate-700/50">
      {matched.slice((current-1)*pageSize, current*pageSize).map((row,i) => <li className="py-2" key={i}>
        {row.text}
        {row.links?.map(({label,url},j) => <a key={j} href={url} target="_blank" rel="noreferrer" className="event-text-button ml-2 underline">{label}</a>)}
      </li>)}
    </ol> : <p className="event-muted">暂无匹配记录</p>}
    {pages > 1 && <nav className="event-pagination" aria-label={title + '明细分页'}>
      <button className="event-icon" type="button" title="上一页" aria-label="上一页" disabled={current === 1} onClick={() => setPage(current-1)}><ChevronLeft size={16}/></button>
      <span>{current} / {pages}</span>
      <button className="event-icon" type="button" title="下一页" aria-label="下一页" disabled={current === pages} onClick={() => setPage(current+1)}><ChevronRight size={16}/></button>
    </nav>}
  </details>;
}
