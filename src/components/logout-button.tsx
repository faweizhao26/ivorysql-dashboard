'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        router.push('/auth');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
    >
      退出
    </button>
  );
}
