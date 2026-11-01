'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from './NavIcon';
import { useAuth } from '@/app/auth-provider';

export const navigationItems = [
  { href: '/', icon: 'home', name: '首页' },
  { href: '/github', icon: 'github', name: 'GitHub' },
  { href: '/social', icon: 'social', name: '社媒' },
  { href: '/content', icon: 'content', name: '内容' },
  { href: '/downloads', icon: 'download', name: '下载' },
  { href: '/evangelist', icon: 'evangelist', name: '布道' },
  { href: '/events', icon: 'events', name: '活动' },
  { href: '/admin', icon: 'admin', name: '后台' },
];

export function NavigationLinks({ pathname, accessLevel, onNavigate }: {
  pathname: string;
  accessLevel: 'admin' | 'viewer' | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="app-navigation" aria-label="主要导航">
      {navigationItems.filter(item => item.href !== '/admin' || accessLevel === 'admin').map(item => {
        const active = pathname === item.href || item.href !== '/' && pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} onClick={onNavigate} className="app-navigation-link"><NavIcon name={item.icon} /><span>{item.name}</span></Link>;
      })}
    </nav>
  );
}

export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || '/';
  const { accessLevel } = useAuth();
  return <NavigationLinks pathname={pathname} accessLevel={accessLevel} onNavigate={onNavigate} />;
}
