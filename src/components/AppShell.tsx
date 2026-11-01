'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import NavLinks, { navigationItems } from './NavLinks';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './logout-button';

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return <Link href="/" className="app-brand" onClick={onNavigate}><span className="app-brand-mark" aria-hidden="true">I</span><span>IvorySQL<small>社区数据中心</small></span></Link>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const drawer = useRef<HTMLDialogElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const authPage = pathname === '/auth';
  const current = navigationItems.find(item => pathname === item.href || item.href !== '/' && pathname.startsWith(`${item.href}/`));
  const closeDrawer = () => drawer.current?.close();

  useEffect(() => { drawer.current?.close(); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    function onResize() { if (desktop.matches) drawer.current?.close(); }
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, []);

  if (authPage) return <div className="app-auth"><header className="app-auth-header"><Brand /><ThemeToggle /></header><main className="app-auth-main">{children}</main></div>;

  return (
    <div className="app-shell">
      <a className="app-skip-link" href="#page-content">跳转到内容</a>
      <aside className="app-sidebar" aria-label="网站导航"><Brand /><NavLinks /><div className="app-sidebar-footer">IvorySQL 社区</div></aside>
      <div className="app-workspace">
        <header className="app-header">
          <div className="app-header-leading"><button type="button" className="app-menu-button app-icon-button" title="打开导航" aria-label="打开导航" aria-controls="mobile-site-navigation" aria-expanded={mobileOpen} onClick={() => { drawer.current?.showModal(); setMobileOpen(true); }}><Menu size={20} aria-hidden="true" /></button><Link href="/" className="app-mobile-brand">IvorySQL</Link><span className="app-breadcrumb">IvorySQL 数据中心<span aria-hidden="true">/</span><strong>{current?.name || '首页'}</strong></span></div>
          <div className="app-header-actions"><ThemeToggle /><LogoutButton /></div>
        </header>
        <main id="page-content" className="app-content" tabIndex={-1}>{children}</main>
      </div>
      <dialog ref={drawer} id="mobile-site-navigation" className="app-mobile-drawer" aria-label="网站导航" onClose={() => setMobileOpen(false)} onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right) closeDrawer(); }}>
        <div className="app-drawer-heading"><Brand onNavigate={closeDrawer} /><button type="button" className="app-icon-button" title="关闭导航" aria-label="关闭导航" onClick={closeDrawer}><X size={20} aria-hidden="true" /></button></div>
        <NavLinks onNavigate={closeDrawer} />
      </dialog>
    </div>
  );
}
