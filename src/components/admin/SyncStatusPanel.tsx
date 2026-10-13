'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth-provider';
import type { AccessLevel } from '@/lib/auth';
import type { SyncPlatformStatus } from '@/lib/sync-runs';

const retryRoutes: Record<string, string> = {
  github: '/api/github/sync',
  itpub: '/api/itpub/sync',
  csdn: '/api/csdn/sync',
  cnblogs: '/api/cnblogs/sync',
  modb: '/api/modb/sync',
  sf: '/api/sf/sync',
};

const platformNames: Record<string, string> = {
  github: 'GitHub',
  itpub: 'ITPUB',
  csdn: 'CSDN',
  cnblogs: '博客园',
  modb: '墨天轮',
  sf: '思否',
  oschina: '开源中国',
  ctoutiao: '51CTO',
  toutiao: '头条号',
  zhihu: '知乎',
};

export function canRetrySync(accessLevel: AccessLevel | null, platform: string): boolean {
  return accessLevel === 'admin' && Boolean(retryRoutes[platform]);
}

function formatTime(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function SyncStatusPanel() {
  const { accessLevel } = useAuth();
  const [items, setItems] = useState<SyncPlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/sync-status', { cache: 'no-store' });
    if (!response.ok) throw new Error('同步状态加载失败');
    const data = await response.json();
    setItems(data.platforms || []);
  }, []);

  useEffect(() => {
    loadStatus().catch(error => setMessage(error.message)).finally(() => setLoading(false));
  }, [loadStatus]);

  async function retry(platform: string) {
    if (!canRetrySync(accessLevel, platform)) return;
    setRetrying(platform);
    setMessage(null);
    try {
      const response = await fetch(retryRoutes[platform], { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `${platformNames[platform] || platform} 同步失败`);
      }
      setMessage(`${platformNames[platform] || platform} 已完成同步`);
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '同步失败');
      await loadStatus().catch(() => undefined);
    } finally {
      setRetrying(null);
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">正在加载同步状态...</p>;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">自动同步状态</h2>
        <p className="mt-1 text-sm text-slate-500">展示每个平台最近一次同步结果；浏览器渠道需通过 ego-lite 更新。</p>
      </div>

      {message && <div className="rounded border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">{message}</div>}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">暂无同步记录</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">平台</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">最近运行</th>
                <th className="px-4 py-3 text-right">读取 / 写入</th>
                <th className="px-4 py-3 text-left">详情</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const retryable = canRetrySync(accessLevel, item.platform);
                return (
                  <tr key={item.platform} className="border-t border-slate-700/70">
                    <td className="px-4 py-3 font-medium text-slate-200">{platformNames[item.platform] || item.platform}</td>
                    <td className="px-4 py-3">
                      <span className={item.status === 'success' ? 'text-emerald-400' : item.status === 'failed' ? 'text-red-400' : 'text-amber-400'}>
                        {item.status === 'success' ? '成功' : item.status === 'failed' ? '失败' : '进行中'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatTime(item.finished_at || item.started_at)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{item.records_seen} / {item.records_written}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-400">
                      {item.error_message || (retryable ? '可在此手动执行' : '通过 ego-lite 更新')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {retryable ? (
                        <button
                          type="button"
                          disabled={retrying === item.platform}
                          onClick={() => retry(item.platform)}
                          className="text-indigo-400 hover:text-indigo-300 disabled:cursor-wait disabled:opacity-50"
                        >
                          {retrying === item.platform ? '同步中...' : '重新同步'}
                        </button>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
