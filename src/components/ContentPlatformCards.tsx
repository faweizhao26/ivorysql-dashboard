'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { CONTENT_PLATFORMS, contentDateQuery, contentSyncState, contentUpdateMode, type ContentPlatformKey } from '@/lib/content-overview';
import { formatLastUpdated } from './LastUpdated';
import type { ArticleDateRange } from '@/lib/article-query';
import { formatArticleMetric } from '@/lib/content-values.mjs';
import type { ArticlePlatformSummary } from '@/lib/db';

interface ContentPlatformCardsProps {
  summaries: ArticlePlatformSummary[];
  selectedPlatform?: string;
  onSelect?: (platform: ContentPlatformKey) => void;
  loading?: boolean;
  dateRange?: ArticleDateRange;
}

export function ContentPlatformCards({ summaries, selectedPlatform, onSelect, loading = false, dateRange }: ContentPlatformCardsProps) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const byPlatform = new Map(summaries.map(summary => [summary.platform, summary]));
  return (
    <div aria-busy={loading} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {CONTENT_PLATFORMS.map(({ key, name }) => {
        const summary = byPlatform.get(key);
        const selected = selectedPlatform === key;
        const state = contentSyncState(key, summary?.sync, now, summary?.sync_unavailable);
        const automatic = contentUpdateMode(key) === 'automatic';
        const updatedAt = formatLastUpdated((automatic ? summary?.sync?.last_success_at : summary?.updated_at) || null);
        const tone = { muted: 'text-slate-500', good: 'text-emerald-400', warning: 'text-amber-400', error: 'text-red-400' }[state.tone];
        const query = new URLSearchParams({ platform: key, ...Object.fromEntries(contentDateQuery(dateRange)) });
        const style = `min-w-0 min-h-52 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`;
        const content = <>
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <PlatformIcon platform={key} className="h-7 w-7 shrink-0 text-xs" />
            <span className="min-w-0 break-words text-sm font-medium text-slate-200">{name}</span>
            {!onSelect && <ArrowUpRight size={14} aria-hidden="true" className="ml-auto shrink-0 text-slate-500" />}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-start justify-between gap-2"><dt className="shrink-0 text-xs leading-5 text-slate-500">文章</dt><dd className="min-w-0 break-all text-right font-semibold tabular-nums text-slate-100">{formatArticleMetric(summary?.article_count)}</dd></div>
            <div className="flex items-start justify-between gap-2"><dt className="shrink-0 text-xs leading-5 text-slate-500">累计阅读</dt><dd className="min-w-0 break-all text-right font-semibold tabular-nums text-slate-100">{formatArticleMetric(summary?.total_views)}</dd></div>
          </dl>
          <div className="mt-3 space-y-1 text-xs leading-5">
            {Boolean(summary?.missing_views) && <p className="text-amber-400">{summary?.missing_views} 篇未获取阅读量</p>}
            <p className={tone}>{loading ? '更新中' : state.label}</p>
            <p className="min-h-5 break-words text-slate-500">{updatedAt ? `${automatic ? '采集' : '更新'}：${updatedAt}` : ''}</p>
          </div>
        </>;
        return onSelect
          ? <button key={key} type="button" data-content-platform={key} aria-pressed={selected} onClick={() => onSelect(key)} className={style}>{content}</button>
          : <Link key={key} data-content-platform={key} href={`/content?${query}`} className={style}>{content}</Link>;
      })}
    </div>
  );
}
