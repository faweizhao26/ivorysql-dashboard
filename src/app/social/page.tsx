'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { PlatformIcon } from '@/components/PlatformIcon';

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

const socialPlatforms = [
  { key: 'wechat', name: '公众号' },
  { key: 'twitter', name: 'Twitter' },
  { key: 'bilibili', name: 'B站' },
  { key: 'youtube', name: 'YouTube' },
];

export default function SocialPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);

  const isSingleDay = dateRange.start === dateRange.end;

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        });
        const res = await fetch(`/api/social?${params}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const socialDataList = data?.social || [];

  const platformData = socialPlatforms.reduce((acc, { key }) => {
    const platformItems = socialDataList.filter(s => s.platform === key);
    const latest = platformItems[platformItems.length - 1];
    const previous = platformItems.length > 1 ? platformItems[platformItems.length - 2] : null;
    acc[key] = {
      current: latest,
      previous,
      history: platformItems
    };
    return acc;
  }, {} as Record<string, { current: any; previous: any; history: any[] }>);

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  const displayDate = isSingleDay ? dateRange.start : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <h1 className="text-2xl font-bold text-slate-100">社交媒体</h1>
        </div>
        {displayDate && (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30">
            📅 存档数据: {displayDate}
          </span>
        )}
      </div>

      <TimeRangeSelector onRangeChange={(range) => {
        setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
        setComparison(range.comparison);
      }} />

      <div className="text-sm text-slate-400">
        当前时间段: <span className="font-medium text-slate-200">{currentPeriod}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialPlatforms.map(({ key, name }) => {
          const platform = platformData[key];
          const current = platform?.current;
          const previous = platform?.previous;

          return (
            <div key={key} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-4">
                <PlatformIcon platform={key} className="w-8 h-8" size={32} />
                <h2 className="text-xl font-semibold text-slate-100">{name}</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <StatCard
                  title="粉丝数"
                  value={current?.followers || current?.subscribers || 0}
                />
                <StatCard
                  title="互动数"
                  value={(current?.likes || 0) + (current?.comments || 0) + (current?.shares || 0)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-slate-400">帖子/视频</div>
                  <div className="font-semibold text-slate-200">{current?.posts || 0}</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-slate-400">阅读/播放</div>
                  <div className="font-semibold text-slate-200">{(current?.views || current?.video_views || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-slate-400">评论</div>
                  <div className="font-semibold text-slate-200">{current?.comments || 0}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
