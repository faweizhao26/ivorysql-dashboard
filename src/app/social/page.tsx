'use client';

import { useEffect, useState } from 'react';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { PlatformIcon } from '@/components/PlatformIcon';
import { downloadCSV } from '@/lib/csv-utils';

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
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today, isSingleDay: true };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<SocialData | null>(null);
  const [articleStats, setArticleStats] = useState<Record<string, { count: number; views: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
        const [socialRes, articlesRes] = await Promise.all([
          fetch(`/api/social?${params}`, { credentials: 'include' }),
          fetch('/api/articles?start=2020-01-01&end=2099-12-31', { credentials: 'include' })
        ]);
        if (socialRes.ok) setData(await socialRes.json());
        if (articlesRes.ok) {
          const json = await articlesRes.json();
          const stats: Record<string, { count: number; views: number }> = {};
          const allPlatforms = json.articles || {};
          for (const [platform, articles] of Object.entries(allPlatforms)) {
            const list = articles as any[];
            stats[platform] = {
              count: list.length,
              views: list.reduce((sum: number, a: any) => sum + (a.views || 0), 0)
            };
          }
          setArticleStats(stats);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [dateRange]);

  if (loading) {
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

  const socialDataList = data?.social || [];
  const platformData = socialPlatforms.reduce((acc, { key }) => {
    const platformItems = socialDataList.filter(s => s.platform === key);
    const latest = platformItems[platformItems.length - 1];
    acc[key] = { current: latest, history: platformItems };
    return acc;
  }, {} as Record<string, { current: any; history: any[] }>);

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  const displayDate = dateRange.start === dateRange.end ? dateRange.start : null;

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
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayDate && (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30 hidden sm:inline-flex">
                {displayDate}
              </span>
            )}
            <button
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialPlatforms.map(({ key, name, accent, description }, index) => {
          const platform = platformData[key];
          const current = platform?.current;
          const followers = current?.followers || current?.subscribers || 0;
          const artStats = articleStats[key];
          const hasArticleData = artStats && artStats.count > 0;
          const posts = hasArticleData ? artStats.count : (current?.posts || 0);
          const views = hasArticleData ? artStats.views : (current?.views || current?.video_views || 0);

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
                  <div className="text-3xl font-bold text-slate-100">{followers.toLocaleString()}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                    <div className="text-slate-500 text-xs mb-1">帖子 / 视频</div>
                    <div className="text-xl font-bold text-slate-200">{posts.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4 text-center">
                    <div className="text-slate-500 text-xs mb-1">阅读 / 播放</div>
                    <div className="text-xl font-bold text-slate-200">
                      {views >= 10000 ? `${(views / 10000).toFixed(1)}万` : views.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
