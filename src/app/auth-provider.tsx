'use client';

import { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { withSessionNotice } from '@/lib/session-response';

interface AuthContextType {
  isLoggedIn: boolean;
  accessLevel: 'admin' | 'viewer' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  accessLevel: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessLevel, setAccessLevel] = useState<'admin' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useLayoutEffect(() => {
    const originalFetch = window.fetch;
    let active = true;
    const wrapped = withSessionNotice(originalFetch.bind(window), () => {
      if (active) setSessionExpired(true);
    }, window.location.origin);
    window.fetch = wrapped;
    return () => {
      active = false;
      if (window.fetch === wrapped) window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check', { signal: controller.signal, cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        if (controller.signal.aborted) return;
        const level = data?.level === 'admin' || data?.level === 'viewer' ? data.level : null;
        setIsLoggedIn(Boolean(level));
        setAccessLevel(level);
        if (level) setSessionExpired(false);
        else if (res.status === 401 && pathname !== '/auth') setSessionExpired(true);
      } catch (error) {
        if (!controller.signal.aborted) { console.error('Auth check failed:', error); setIsLoggedIn(false); setAccessLevel(null); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    checkAuth();
    return () => controller.abort();
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, accessLevel, loading }}>
      {sessionExpired && pathname !== '/auth' && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900 p-6 text-slate-100 shadow-xl">
            <h2 id="session-expired-title" className="text-lg font-semibold">登录已失效</h2>
            <p className="mt-2 text-sm text-slate-400">请重新登录后继续操作。</p>
            <Link href={`/auth?redirect=${encodeURIComponent(pathname)}`} className="mt-5 inline-block rounded border border-slate-500 px-4 py-2 text-sm font-medium">重新登录</Link>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
