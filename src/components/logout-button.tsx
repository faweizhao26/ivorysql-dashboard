'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 text-sm font-medium text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
    >
      退出
    </button>
  );
}