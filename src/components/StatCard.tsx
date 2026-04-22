'use client';

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
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-xl">
            {icon}
          </div>
        )}
        <span className="text-sm text-secondary font-medium">{title}</span>
      </div>
      <div className="text-3xl font-bold text-primary mb-2">
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
    <div className="card p-6 stat-card">
      <div className="flex items-center gap-3 mb-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-xl">
            {icon}
          </div>
        )}
        <span className="text-sm text-secondary font-medium">{title}</span>
      </div>
      <div className="text-3xl font-bold text-primary mb-1">
        {prefix}{typeof current === 'number' ? current.toLocaleString() : current}{suffix}
      </div>
      {previous !== undefined && (
        <div className="text-sm text-muted mb-2">
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
  icon: string;
  followers?: number;
  views?: number;
  articles?: number;
  change?: number;
  changePeriod?: string;
}

export function PlatformCard({ name, icon, followers, views, articles, change, changePeriod }: PlatformCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <span className="font-semibold text-primary">{name}</span>
      </div>
      <div className="space-y-3 text-sm">
        {followers !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted">粉丝</span>
            <span className="font-semibold text-primary">{followers.toLocaleString()}</span>
          </div>
        )}
        {views !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted">阅读/播放</span>
            <span className="font-semibold text-primary">{views.toLocaleString()}</span>
          </div>
        )}
        {articles !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted">文章</span>
            <span className="font-semibold text-primary">{articles.toLocaleString()}</span>
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