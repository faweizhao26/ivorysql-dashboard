'use client';

import { useEffect, useState } from 'react';
import { getBeijingDate } from '@/lib/date';
import { fetchMetricPeriods, metricChange } from '@/lib/metric-periods';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { PlatformIcon } from '@/components/PlatformIcon';
import { downloadCSV } from '@/lib/csv-utils';
import LastUpdated from '@/components/LastUpdated';
import { formatFreshnessLabel, getLatestUpdatedAt, type DataSlice } from '@/lib/data-slices';

interface SocialData {
  social: Array<{
    date: string;
    platform: string;
    followers: number;
    posts: number;
    views: number;
    likes: number;
    shares: number;
    comments: number;
    subscribers: number;
    video_views: number;
  }>;
  freshness: Record<string, DataSlice<unknown>>;
}

interface PlatformCardData {
  key: string;
  name: string;
  accent: string;
  description: string;
}

const socialPlatforms: PlatformCardData[] = [
  { key: 'wechat', name: '公众号', accent: '#07C160', description: '微信公众平台' },
  { key: 'shipinhao', name: '视频号', accent: '#fa9d3b', description: '微信视频号' },
  { key: 'twitter', name: 'Twitter', accent: '#1b8ef2', description: '海外社交媒体' },
  { key: 'bilibili', name: 'B站', accent: '#00A1D6', description: '视频社区' },
  { key: 'youtube', name: 'YouTube', accent: '#FF0000', description: '视频平台' },
];

export default function SocialPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = getBeijingDate();
    return { start: today, end: today, isSingleDay: true };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<SocialData | null>(null);
  const [previous, setPrevious] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true); setError(null); setPrevious(null); setComparisonError(null);
      try {
        const result = await fetchMetricPeriods<SocialData>('/api/social', dateRange,
          comparison?.enabled ? comparison.customRange : undefined, controller.signal);
        if (controller.signal.aborted) return;
        setData(result.current); setPrevious(result.previous); setComparisonError(result.comparisonError);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '数据加载失败'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    fetchData();
    return () => controller.abort();
  }, [dateRange, comparison]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-slate-800/50 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-8 h-48 animate-pulse">
              <div className="h-4 w-24 bg-slate-700 rounded mb-4" />
              <div className="h-10 w-32 bg-slate-700 rounded mb-3" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-12 bg-slate-700 rounded-lg" />
                <div className="h-12 bg-slate-700 rounded-lg" />
                <div className="h-12 bg-slate-700 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const socialDataList = loading || error ? [] : data?.social || [];
  const platformData = socialPlatforms.reduce((acc, { key }) => {
    const platformItems = socialDataList.filter(s => s.platform === key);
    const latest = platformItems[platformItems.length - 1];
    acc[key] = { current: latest, history: platformItems };
    return acc;
  }, {} as Record<string, { current: SocialData['social'][number] | undefined; history: SocialData['social'] }>);

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  const displayDate = dateRange.start === dateRange.end ? dateRange.start : null;
  const lastUpdated = getLatestUpdatedAt(Object.values(data?.freshness || {}));
  const previousByPlatform = Object.fromEntries((previous?.social || []).map(item => [item.platform, item]));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">社交媒体</h1>
              <p className="text-slate-500 text-sm">{displayDate ? '单日数据快照' : '时段数据概览'}</p>
              <p className="mt-1 text-xs text-slate-500"><LastUpdated value={lastUpdated} /></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayDate && (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30 hidden sm:inline-flex">
                {displayDate}
              </span>
            )}
            <button
              disabled={loading || Boolean(error) || !data}
              onClick={() => exportSocialData(socialDataList, currentPeriod)}
              className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors"
            >
              导出 CSV
            </button>
          </div>
        </div>
      </div>

      <TimeRangeSelector onRangeChange={(range) => {
        setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
        setComparison(range.comparison);
      }} />

      <div className="text-sm text-slate-500">{currentPeriod}</div>
      {loading && <p role="status" className="text-sm text-slate-400">正在更新数据…</p>}
      {(error || comparisonError) && <p role="alert" className="text-sm text-amber-400">{error || comparisonError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialPlatforms.map(({ key, name, accent, description }, index) => {
          const platform = platformData[key];
          const current = platform?.current;
          const followers = current ? current.followers || current.subscribers : undefined;
          const posts = current?.posts;
          const views = current ? current.views || current.video_views : undefined;
          const before = previousByPlatform[key];

          return (
            <div key={key} className="card p-8 relative overflow-hidden group" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: accent }} />
              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
                    <PlatformIcon platform={key} size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">{name}</h2>
                    <p className="text-slate-500 text-xs">{description}</p>
                  </div>
                </div>

                <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}15` }}>
                  <div className="text-slate-400 text-xs font-medium mb-1">粉丝 / 订阅者</div>
                  <div className="text-3xl font-bold text-slate-100">{followers?.toLocaleString() ?? '-'}</div>
                  <PreviousMetric current={followers} previous={before ? before.followers || before.subscribers : undefined} enabled={Boolean(comparison?.enabled)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                    <div className="text-slate-500 text-xs mb-1">帖子 / 视频</div>
                    <div className="text-xl font-bold text-slate-200">{posts?.toLocaleString() ?? '-'}</div>
                    <PreviousMetric current={posts} previous={before?.posts} enabled={Boolean(comparison?.enabled)} />
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                    <div className="text-slate-500 text-xs mb-1">阅读 / 播放</div>
                    <div className="text-xl font-bold text-slate-200">
                      {views === undefined ? '-' : views >= 10000 ? `${(views / 10000).toFixed(1)}万` : views.toLocaleString()}
                    </div>
                    <PreviousMetric current={views} previous={before ? before.views || before.video_views : undefined} enabled={Boolean(comparison?.enabled)} />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{formatFreshnessLabel(loading || error ? null : data?.freshness?.[key])}</p>
                {!loading && comparison?.enabled && <p className="mt-1 text-xs text-slate-500">对比期：{formatFreshnessLabel(previous?.freshness?.[key])}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviousMetric({ current, previous, enabled }: { current: number | undefined; previous: number | undefined; enabled: boolean }) {
  if (!enabled) return null;
  const change = metricChange(current, previous);
  return <p className="mt-1 text-xs text-slate-400">{previous === undefined ? '对比期暂无数据' : `对比期 ${previous.toLocaleString()}`}{change !== undefined && <span className={change >= 0 ? 'ml-2 text-emerald-400' : 'ml-2 text-red-400'}>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>}</p>;
}

function exportSocialData(data: SocialData['social'], period: string) {
  if (!data || data.length === 0) return;
  const rows = data.map(s => ({
    平台: s.platform, 日期: s.date, 粉丝: s.followers, 订阅者: s.subscribers,
    帖子: s.posts, 阅读: s.views, 视频播放: s.video_views,
    点赞: s.likes, 分享: s.shares, 评论: s.comments, 时间段: period,
  }));
  downloadCSV(rows, `ivorysql-social-${period.replace(/[~ ]/g, '_')}`);
}
