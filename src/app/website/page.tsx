'use client';

import { useEffect, useState } from 'react';
import { StatCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { TrendChart } from '@/components/Charts';

interface WebsiteData {
  website: {
    latest: {
      date: string;
      pageviews: number;
      unique_visitors: number;
      top_pages: string[];
      sources: { name: string; value: number }[];
      keywords: string[];
    } | null;
    history: Array<{
      date: string;
      pageviews: number;
      unique_visitors: number;
    }>;
  };
}

export default function WebsitePage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<WebsiteData | null>(null);
  const [loading, setLoading] = useState(true);

  const isSingleDay = dateRange.start === dateRange.end;

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        });
        const res = await fetch(`/api/website?${params}`, {
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

  const website = data?.website;
  const websiteHistory = website?.history || [];
  const latestWebsite = website?.latest;

  const prevWebsite = websiteHistory.length > 1 ? websiteHistory[websiteHistory.length - 2] : null;

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  const displayDate = isSingleDay ? dateRange.start : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌐</span>
          <h1 className="text-2xl font-bold text-slate-100">官网数据</h1>
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

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">访问数据</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="页面访问量 (PV)"
            value={latestWebsite?.pageviews || 0}
            change={prevWebsite ? calculateChange(latestWebsite?.pageviews || 0, prevWebsite.pageviews) : undefined}
            icon="📄"
          />
          <StatCard
            title="独立访客 (UV)"
            value={latestWebsite?.unique_visitors || 0}
            change={prevWebsite ? calculateChange(latestWebsite?.unique_visitors || 0, prevWebsite.unique_visitors) : undefined}
            icon="👥"
          />
          <StatCard
            title="PV/UV 比"
            value={latestWebsite?.unique_visitors
              ? (latestWebsite.pageviews / latestWebsite.unique_visitors).toFixed(1)
              : '0'}
            icon="📊"
          />
          <StatCard
            title="数据来源"
            value={latestWebsite?.sources?.length || 0}
            suffix=" 个"
            icon="🌍"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {websiteHistory.length > 0 && (
          <TrendChart
            title={`页面访问量趋势 (${currentPeriod})`}
            data={websiteHistory.map(h => ({ date: h.date, pageviews: h.pageviews }))}
            dataKey="pageviews"
            color="#F59E0B"
          />
        )}
        {websiteHistory.length > 0 && (
          <TrendChart
            title={`独立访客趋势 (${currentPeriod})`}
            data={websiteHistory.map(h => ({ date: h.date, visitors: h.unique_visitors }))}
            dataKey="visitors"
            color="#10B981"
          />
        )}
      </div>

      {latestWebsite && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">热门页面</h3>
            {latestWebsite.top_pages && latestWebsite.top_pages.length > 0 ? (
              <div className="space-y-2">
                {latestWebsite.top_pages.slice(0, 10).map((page: string, index: number) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 truncate flex-1">{page}</span>
                    <span className="text-slate-500 ml-2">{index + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500">暂无数据</div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">流量来源</h3>
            {latestWebsite.sources && latestWebsite.sources.length > 0 ? (
              <div className="space-y-2">
                {latestWebsite.sources.slice(0, 10).map((source: { name: string; value: number }, index: number) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">{source.name}</span>
                    <span className="font-medium text-slate-200">{source.value}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500">暂无数据</div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">搜索关键词</h3>
            {latestWebsite.keywords && latestWebsite.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {latestWebsite.keywords.slice(0, 20).map((keyword: string, index: number) => (
                  <span key={index} className="px-3 py-1 bg-slate-900/50 text-slate-300 text-sm rounded-full">
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-slate-500">暂无数据</div>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">说明</h3>
        <div className="text-sm text-slate-400 space-y-2">
          <p>• <strong className="text-slate-300">数据来源：</strong>Google Analytics API 自动获取</p>
          <p>• <strong className="text-slate-300">更新频率：</strong>每日自动更新</p>
          <p>• <strong className="text-slate-300">PV（Page Views）：</strong>页面浏览量</p>
          <p>• <strong className="text-slate-300">UV（Unique Visitors）：</strong>独立访客数</p>
        </div>
      </div>
    </div>
  );
}
