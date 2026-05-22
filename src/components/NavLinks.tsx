'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from './NavIcon';

const items = [
  { href: '/', icon: 'home', name: '首页' },
  { href: '/github', icon: 'github', name: 'GitHub' },
  { href: '/social', icon: 'social', name: '社媒' },
  { href: '/content', icon: 'content', name: '内容' },
  { href: '/website', icon: 'website', name: '官网' },
  { href: '/events', icon: 'events', name: '活动' },
  { href: '/admin', icon: 'admin', name: '管理' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex items-center gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href
          || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <NavIcon name={item.icon} className={isActive ? 'opacity-100' : 'opacity-60'} />
            <span className="hidden lg:inline">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function MobileNavLinks() {
  const pathname = usePathname();

  return (
    <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-thin">
      {items.map((item) => {
        const isActive = pathname === item.href
          || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap flex items-center gap-1 transition-colors ${
              isActive
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <NavIcon name={item.icon} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
