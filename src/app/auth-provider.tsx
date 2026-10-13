'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

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

  useEffect(() => {
    const controller = new AbortController();
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check', { signal: controller.signal, cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        const level = data?.level === 'admin' || data?.level === 'viewer' ? data.level : null;
        setIsLoggedIn(Boolean(level));
        setAccessLevel(level);
      } catch (error) {
        if (!controller.signal.aborted) { console.error('Auth check failed:', error); setIsLoggedIn(false); setAccessLevel(null); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    checkAuth();
    return () => controller.abort();
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, accessLevel, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
