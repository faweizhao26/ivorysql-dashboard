export interface DatedMetric {
  date: string;
  updated_at?: string | Date | null;
}

export interface DataSlice<T> {
  requested_date?: string;
  data_date: string | null;
  updated_at: string | null;
  has_exact_data: boolean;
  data: T | null;
}

export function formatFreshnessLabel(slice: DataSlice<unknown> | null | undefined): string {
  if (!slice?.data_date) return '暂无可用数据';
  if (slice.requested_date && !slice.has_exact_data) {
    return `最新可用数据：${slice.data_date}`;
  }
  return `数据日期：${slice.data_date}`;
}

export function getLatestUpdatedAt(
  slices: Array<DataSlice<unknown> | null | undefined>,
): string | null {
  return slices.reduce<string | null>((latest, slice) => {
    if (!slice?.updated_at) return latest;
    return !latest || slice.updated_at > latest ? slice.updated_at : latest;
  }, null);
}

function timestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function createDataSlice<T extends DatedMetric>(
  requestedDate: string | undefined,
  exact: T | null,
  fallback: T | null,
): DataSlice<T> {
  const data = exact || fallback;
  return {
    ...(requestedDate ? { requested_date: requestedDate } : {}),
    data_date: data?.date || null,
    updated_at: timestamp(data?.updated_at),
    has_exact_data: Boolean(exact),
    data,
  };
}

export function createPlatformFreshness<T extends DatedMetric & { platform: string }>(
  platforms: string[],
  requestedDate: string | undefined,
  exactRows: T[],
  fallbackRows: T[],
): Record<string, DataSlice<T>> {
  const exact = new Map(exactRows.map(row => [row.platform, row]));
  const fallback = new Map(fallbackRows.map(row => [row.platform, row]));
  return Object.fromEntries(platforms.map(platform => [
    platform,
    createDataSlice(requestedDate, exact.get(platform) || null, fallback.get(platform) || null),
  ]));
}
