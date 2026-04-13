'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessLevel, setAccessLevel] = useState<'admin' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/check');
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(true);
        setAccessLevel(data.level);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, accessLevel, loading }}>
      {children}
    </AuthContext.Provider>
  );
}