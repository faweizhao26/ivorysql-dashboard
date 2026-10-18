import { getDataRangeParams } from './date-query';

interface MetricRange { start: string; end: string }

export async function fetchMetricPeriods<T>(
  endpoint: string,
  currentRange: MetricRange,
  previousRange: MetricRange | undefined,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<{ current: T; previous: T | null; comparisonError: string | null }> {
  async function load(range: MetricRange): Promise<T> {
    const params = new URLSearchParams({ start: range.start, end: range.end });
    getDataRangeParams(params);
    const response = await fetcher(`${endpoint}?${params}`, { credentials: 'include', signal });
    if (!response.ok) throw new Error(`数据加载失败（HTTP ${response.status}）`);
    return response.json();
  }
  const [current, comparison] = await Promise.all([
    load(currentRange),
    previousRange ? load(previousRange).then(
      data => ({ data, error: null }),
      () => ({ data: null, error: '对比数据加载失败，请重试' }),
    ) : Promise.resolve({ data: null, error: null }),
  ]);
  return { current, previous: comparison.data, comparisonError: comparison.error };
}

export function metricChange(current: number | undefined, previous: number | undefined): number | undefined {
  if (current === undefined || previous === undefined || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}
