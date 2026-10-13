'use client';
import { Search } from 'lucide-react';
import { EVENT_TYPES, type EventFiltersValue } from '@/lib/events-ui';
export function EventFilters({ value, years, onChange }: {
  value: EventFiltersValue; years: string[]; onChange: (value: EventFiltersValue) => void;
}) {
  const style = 'min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200';
  return <div className="flex flex-wrap gap-3 border-y border-slate-700 py-4">
    <label className="relative min-w-48 flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
      <input aria-label="搜索活动" maxLength={100} placeholder="搜索活动" value={value.search} onChange={e => onChange({ ...value, search: e.target.value })} className={`${style} w-full pl-9`} />
    </label>
    <select aria-label="活动年份" value={value.year} onChange={e => onChange({ ...value, year: e.target.value })} className={style}>
      <option value="">全部年份</option>{years.map(year => <option key={year} value={year}>{year} 年</option>)}
    </select>
    <select aria-label="活动类型" value={value.type} onChange={e => onChange({ ...value, type: e.target.value })} className={style}>
      <option value="">全部类型</option>{EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
    </select>
  </div>;
}
