'use client';

import { PlatformIcon } from './PlatformIcon';

interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
}

export function StatCard({ title, value, change, changeLabel, prefix = '', suffix = '', icon }: StatCardProps) {
  return (
    <div className="card p-6 hover:scale-[1.02]">
      <div className="flex items-center gap-3 mb-3">
        {icon && (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/10">
            {icon}
          </div>
        )}
        <span className="text-sm text-slate-400 font-medium">{title}</span>
      </div>
      <div className="text-4xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent mb-2">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </div>
      {change !== undefined && change !== 0 && (
        <div className={`text-sm font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%{changeLabel && ` ${changeLabel}`}
        </div>
      )}
    </div>
  );
}

interface ComparisonStatCardProps {
  title: string;
  current: number | string;
  previous?: number | string;
  change?: number;
  prefix?: string;
  suffix?: string;
  icon?: string;
  periodLabel?: string;
}

export function ComparisonStatCard({
  title,
  current,
  previous,
  change,
  prefix = '',
  suffix = '',
  icon,
  periodLabel
}: ComparisonStatCardProps) {
  return (
    <div className="card p-6 stat-card hover:scale-[1.02]">
      <div className="flex items-center gap-3 mb-3">
        {icon && (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/10">
            {icon}
          </div>
        )}
        <span className="text-sm text-slate-400 font-medium">{title}</span>
      </div>
      <div className="text-4xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent mb-1">
        {prefix}{typeof current === 'number' ? current.toLocaleString() : current}{suffix}
      </div>
      {previous !== undefined && (
        <div className="text-sm text-slate-500 mb-2">
          上期: {typeof previous === 'number' ? previous.toLocaleString() : previous}
          {periodLabel && <span className="ml-2 text-xs opacity-70">({periodLabel})</span>}
        </div>
      )}
      {change !== undefined && change !== 0 && (
        <div className={`text-sm font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

interface PlatformCardProps {
  name: string;
  icon?: string;
  platform?: string;
  followers?: number;
  views?: number;
  articles?: number;
  change?: number;
  changePeriod?: string;
}

export function PlatformCard({ name, icon, platform, followers, views, articles, change, changePeriod }: PlatformCardProps) {
  return (
    <div className="card p-5 hover:scale-[1.02]">
      <div className="flex items-center gap-3 mb-4">
        {platform ? (
          <PlatformIcon platform={platform} className="w-8 h-8 text-sm" />
        ) : (
          <span className="text-2xl">{icon}</span>
        )}
        <span className="font-semibold text-slate-100">{name}</span>
      </div>
      <div className="space-y-3 text-sm">
        {followers !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500">粉丝</span>
            <span className="font-semibold bg-gradient-to-r from-slate-200 to-slate-300 bg-clip-text text-transparent">{followers.toLocaleString()}</span>
          </div>
        )}
        {views !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500">阅读/播放</span>
            <span className="font-semibold bg-gradient-to-r from-slate-200 to-slate-300 bg-clip-text text-transparent">{views.toLocaleString()}</span>
          </div>
        )}
        {articles !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500">文章</span>
            <span className="font-semibold bg-gradient-to-r from-slate-200 to-slate-300 bg-clip-text text-transparent">{articles.toLocaleString()}</span>
          </div>
        )}
      </div>
      {change !== undefined && change !== 0 && (
        <div className={`text-xs mt-3 font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%{changePeriod && ` ${changePeriod}`}
        </div>
      )}
    </div>
  );
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export { calculateChange };