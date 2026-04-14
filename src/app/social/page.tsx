'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';

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
  { key: 'wechat', icon: '💚', name: '公众号' },
  { key: 'twitter', icon: '🐦', name: 'Twitter' },
  { key: 'bilibili', icon: '📺', name: 'B站' },
  { key: 'youtube', icon: '▶️', name: 'YouTube' },
];

export default function SocialPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      start: weekAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
      isSingleDay: false
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
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
          <h1 className="text-2xl font-bold text-gray-900">社交媒体</h1>
        </div>
        {displayDate && (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
            📅 存档数据: {displayDate}
          </span>
        )}
      </div>

      <TimeRangeSelector onRangeChange={(range) => {
        setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
        setComparison(range.comparison);
      }} />

      <div className="text-sm text-gray-500">
        当前时间段: <span className="font-medium text-gray-700">{currentPeriod}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialPlatforms.map(({ key, icon, name }) => {
          const platform = platformData[key];
          const current = platform?.current;
          const previous = platform?.previous;

          return (
            <div key={key} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{icon}</span>
                <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
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
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-gray-500">帖子/视频</div>
                  <div className="font-semibold">{current?.posts || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-gray-500">阅读/播放</div>
                  <div className="font-semibold">{(current?.views || current?.video_views || 0).toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-gray-500">评论</div>
                  <div className="font-semibold">{current?.comments || 0}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
