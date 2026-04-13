'use client';

import Link from 'next/link';

const navItems = [
  { href: '/', label: '🏠 首页', exact: true },
  { href: '/github', label: '📊 GitHub' },
  { href: '/social', label: '📱 社媒' },
  { href: '/content', label: '📝 内容' },
  { href: '/website', label: '🌐 官网' },
  { href: '/admin', label: '⚙️ 管理' },
];

export function Navigation({ currentPath }: { currentPath: string }) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">I</span>
              </div>
              <span className="text-xl font-bold text-gray-900">IvorySQL 数据中心</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = item.exact 
                  ? currentPath === item.href 
                  : currentPath.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-400">
              最后更新: {new Date().toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
      <div className="md:hidden border-t border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? currentPath === item.href 
            : currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1 text-sm font-medium rounded-lg whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </div>
      {change !== undefined && change !== 0 && (
        <div className={`text-sm mt-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {prefix}{typeof current === 'number' ? current.toLocaleString() : current}{suffix}
      </div>
      {previous !== undefined && (
        <div className="text-sm text-gray-400 mt-1">
          上期: {typeof previous === 'number' ? previous.toLocaleString() : previous}
          {periodLabel && <span className="ml-2 text-xs">({periodLabel})</span>}
        </div>
      )}
      {change !== undefined && change !== 0 && (
        <div className={`text-sm mt-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-gray-900">{name}</span>
      </div>
      <div className="space-y-2 text-sm">
        {followers !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-500">粉丝</span>
            <span className="font-medium">{followers.toLocaleString()}</span>
          </div>
        )}
        {views !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-500">阅读/播放</span>
            <span className="font-medium">{views.toLocaleString()}</span>
          </div>
        )}
        {articles !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-500">文章</span>
            <span className="font-medium">{articles.toLocaleString()}</span>
          </div>
        )}
      </div>
      {change !== undefined && change !== 0 && (
        <div className={`text-xs mt-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
