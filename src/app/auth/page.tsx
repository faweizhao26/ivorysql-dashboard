'use client';

import { useState } from 'react';

export default function AuthPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = '/';
      } else {
        setError(data.error || '密码错误');
      }
    } catch (err) {
      setError('发生错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-5">
      <div className="bg-slate-800 rounded-2xl p-10 w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-xl">I</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">IvorySQL 数据中心</h1>
          <p className="text-slate-400 text-sm">请输入密码访问</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-200 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm text-center border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            {loading ? '验证中...' : '进入面板'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">
            <span className="text-slate-400 font-medium">查看密码：</span>只读，可查看所有数据
          </p>
          <p className="text-xs text-slate-500">
            <span className="text-slate-400 font-medium">管理密码：</span>完整权限，可编辑数据
          </p>
        </div>
      </div>
    </div>
  );
}
