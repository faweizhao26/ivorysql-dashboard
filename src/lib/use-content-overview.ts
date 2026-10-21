'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchContentOverview, type ContentOverview } from './content-overview';
import type { ArticleDateRange } from './article-query';

export function useContentOverview(range?: ArticleDateRange) {
  const [overview, setOverview] = useState<ContentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const activeKey = useRef<string | null>(null);
  const start = range?.start;
  const end = range?.end;
  const key = `${start || ''}/${end || ''}`;

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRequestedKey(key);
    if (activeKey.current !== key) setOverview(null);
    activeKey.current = key;
    setLoading(true);
    setError('');
    try {
      const result = await fetchContentOverview(controller.signal, fetch, start && end ? { start, end } : undefined);
      if (!controller.signal.aborted) setOverview(result);
    } catch (err) {
      if (!controller.signal.aborted) {
        setOverview(null);
        setError(err instanceof Error ? err.message : '平台汇总加载失败，请重试');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [start, end, key]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      controllerRef.current?.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const current = requestedKey === key;
  return { overview: current ? overview : null, loading: !current || loading, error: current ? error : '', refresh };
}
