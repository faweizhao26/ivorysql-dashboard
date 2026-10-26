'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { getDateRange, createCustomDateRange } from './TimeRangeSelector';
import type { ArticleDateRange } from '@/lib/article-query';

export function ContentDateFilter({ dateRange, onChange }: { dateRange?: ArticleDateRange; onChange: (range?: ArticleDateRange) => void }) {
  const initialPreset = !dateRange ? 'all' : (['today', '7d', '30d', '90d'] as const).find(key => {
    const range = getDateRange(key);
    return range.start === dateRange.start && range.end === dateRange.end;
  }) || 'custom';
  const [preset, setPreset] = useState<string>(initialPreset);
  const [start, setStart] = useState(dateRange?.start || '');
  const [end, setEnd] = useState(dateRange?.end || '');
  const range = createCustomDateRange(start, end);
  const style = 'min-w-0 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200';
  return <form aria-label="发布日期筛选" onSubmit={event => { event.preventDefault(); if (range) onChange(range); }} className="flex flex-wrap items-end gap-3">
    <label className="flex flex-col gap-1 text-xs text-slate-400">发布日期
      <select aria-label="发布日期范围" value={preset} onChange={event => {
        const value = event.target.value;
        setPreset(value);
        if (value === 'all') onChange();
        else if (value === 'today' || value === '7d' || value === '30d' || value === '90d') onChange(getDateRange(value));
      }} className={style}>
        <option value="all">全部日期</option><option value="today">今天</option><option value="7d">最近 7 天</option><option value="30d">最近 30 天</option><option value="90d">最近 90 天</option><option value="custom">自定义</option>
      </select>
    </label>
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">开始日期<input required aria-label="发布开始日期" type="date" value={start} onChange={event => { setPreset('custom'); setStart(event.target.value); }} className={`${style} w-40 max-w-full`} /></label>
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">结束日期<input required aria-label="发布结束日期" type="date" min={start || undefined} value={end} onChange={event => { setPreset('custom'); setEnd(event.target.value); }} className={`${style} w-40 max-w-full`} /></label>
    <button type="submit" aria-label="应用发布日期" title="应用发布日期" disabled={!range} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-600 text-slate-200 disabled:opacity-40"><Check size={18} /></button>
    {start && end && !range && <p role="alert" className="w-full text-xs text-red-400">请选择有效日期，开始日期不能晚于结束日期。</p>}
  </form>;
}
