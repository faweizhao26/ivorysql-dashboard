export function syncFreshness(platform: string, lastSuccessAt: string | null, now = Date.now()): 'fresh' | 'stale' | 'never' {
  const successAt = lastSuccessAt ? Date.parse(lastSuccessAt) : NaN;
  if (!Number.isFinite(successAt)) return 'never';
  const graceDays = platform === 'itpub' ? 9 : 2;
  return now - successAt > graceDays * 86400000 ? 'stale' : 'fresh';
}
