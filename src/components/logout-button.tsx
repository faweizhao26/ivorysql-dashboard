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
      className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    >
      退出
    </button>
  );
}