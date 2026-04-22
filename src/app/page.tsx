'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ComparisonStatCard, PlatformCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { TrendChart } from '@/components/Charts';
import { ActivityTimeline } from '@/components/Timeline';

interface DashboardData {
  github: {
    latest: {
      stars: number;
      forks: number;
      watchers: number;
      open_issues: number;
      open_prs: number;
      contributors: number;
      releases_count: number;
    } | null;
    history: Array<{
      date: string;
      stars: number;
      forks: number;
      contributors: number;
    }>;
  };
  contributors: {
    latest: {
      total_contributors: number;
      contributors_before_2026: number;
      cumulative_2026: number;
      new_contributors_monthly: number;
    } | null;
    history: Array<{
      date: string;
      cumulative_2026: number;
      new_contributors_daily: number;
    }>;
  };
  social: Array<{
    platform: string;
    followers: number;
    views: number;
  }>;
  articles: Array<{
    platform: string;
    article_count: number;
    total_views: number;
  }>;
  website: {
    latest: {
      pageviews: number;
      unique_visitors: number;
    } | null;
    history: Array<{
      date: string;
      pageviews: number;
    }>;
  };
  events: Array<{
    date: string;
    source: string;
    title: string;
    description: string;
    url: string;
    event_type: string;
  }>;
}

const socialPlatforms: Record<string, { icon: string; name: string }> = {
  wechat: { icon: '💚', name: '公众号' },
  twitter: { icon: '🐦', name: 'Twitter' },
  bilibili: { icon: '📺', name: 'B站' },
  youtube: { icon: '▶️', name: 'YouTube' },
};

const contentPlatforms: Record<string, { icon: string; name: string }> = {
  csdn: { icon: '🔵', name: 'CSDN' },
  juejin: { icon: '💎', name: '掘金' },
  modb: { icon: '🟠', name: '墨天轮' },
  oschina: { icon: '🟢', name: '开源中国' },
  sf: { icon: '⚡', name: '思否' },
  ctoutiao: { icon: '📰', name: '51CTO' },
  itpub: { icon: '🔷', name: 'ITPUB' },
  toutiao: { icon: '📱', name: '头条号' },
  ifclub: { icon: '💬', name: 'IFCLUB' },
};

export default function HomePage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isSingleDay = dateRange.start === dateRange.end;

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        });
        if (comparison?.enabled) {
          params.set('compare', 'true');
        }
        const res = await fetch(`/api/dashboard?${params}`, {
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
  }, [dateRange, comparison]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const github = data?.github;
  const contributors = data?.contributors;
  const social = data?.social || [];
  const articles = data?.articles || [];
  const website = data?.website;
  const events = data?.events || [];

  const githubHistory = github?.history || [];
  const contributorHistory = contributors?.history || [];
  const websiteHistory = website?.history || [];

  const latestGitHub = github?.latest;
  const latestWebsite = website?.latest;
  const displayDate = isSingleDay ? dateRange.start : null;

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  let comparePeriod = '';
  if (comparison?.enabled && comparison.customRange) {
    comparePeriod = `${comparison.customRange.start} ~ ${comparison.customRange.end}`;
  }

  const socialData = social.reduce((acc, item) => {
    acc[item.platform] = item;
    return acc;
  }, {} as Record<string, { followers: number; views: number }>);

  const articleData = articles.reduce((acc, item) => {
    acc[item.platform] = item;
    return acc;
  }, {} as Record<string, { article_count: number; total_views: number }>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-100">数据概览</h1>
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
        {comparePeriod && (
          <>
            {' | 对比: '}<span className="font-medium text-slate-200">{comparePeriod}</span>
          </>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">核心指标</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ComparisonStatCard
            title="GitHub Stars"
            current={latestGitHub?.stars || 0}
            icon="⭐"
            periodLabel={comparePeriod ? 'vs 上期' : undefined}
          />
          <ComparisonStatCard
            title="GitHub Forks"
            current={latestGitHub?.forks || 0}
            icon="🍴"
            periodLabel={comparePeriod ? 'vs 上期' : undefined}
          />
          <ComparisonStatCard
            title="公众号关注"
            current={socialData.wechat?.followers || 0}
            icon="💚"
            periodLabel={comparePeriod ? 'vs 上期' : undefined}
          />
          <ComparisonStatCard
            title="Twitter 粉丝"
            current={socialData.twitter?.followers || 0}
            icon="🐦"
            periodLabel={comparePeriod ? 'vs 上期' : undefined}
          />
          <ComparisonStatCard
            title="官网 PV"
            current={latestWebsite?.pageviews || 0}
            icon="🌐"
            periodLabel={comparePeriod ? 'vs 上期' : undefined}
          />
          <ComparisonStatCard
            title="贡献者数"
            current={contributors?.latest?.total_contributors || latestGitHub?.contributors || 0}
            icon="👥"
            periodLabel={comparePeriod ? 'vs 上期' : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {githubHistory.length > 0 && (
          <TrendChart
            title={`Stars 趋势 (${currentPeriod})`}
            data={githubHistory.map(h => ({ date: h.date, stars: h.stars, forks: h.forks }))}
            dataKey="stars"
            color="#6366F1"
          />
        )}
        {contributorHistory.length > 0 && (
          <TrendChart
            title={`贡献者增长趋势 (${currentPeriod})`}
            data={contributorHistory.map(h => ({ date: h.date, cumulative: h.cumulative_2026 }))}
            dataKey="cumulative"
            color="#A855F7"
          />
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">社交媒体</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(socialPlatforms).map(([key, { icon, name }]) => (
            <PlatformCard
              key={key}
              name={name}
              icon={icon}
              followers={socialData[key]?.followers}
              views={socialData[key]?.views}
              changePeriod={comparePeriod ? 'vs 上期' : undefined}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">技术内容平台</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(contentPlatforms).map(([key, { icon, name }]) => (
            <PlatformCard
              key={key}
              name={name}
              icon={icon}
              articles={articleData[key]?.article_count}
              views={articleData[key]?.total_views}
              changePeriod={comparePeriod ? 'vs 上期' : undefined}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {websiteHistory.length > 0 && (
          <TrendChart
            title={`官网访问量趋势 (${currentPeriod})`}
            data={websiteHistory.map(h => ({ date: h.date, pageviews: h.pageviews }))}
            dataKey="pageviews"
            color="#F59E0B"
          />
        )}
        <ActivityTimeline events={events} title="最新动态" />
      </div>
    </div>
  );
}
