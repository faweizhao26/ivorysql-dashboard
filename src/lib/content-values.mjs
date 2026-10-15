/** @param {unknown} value */
export function normalizeMetric(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
  if (typeof value !== 'string') return undefined;
  const match = value.trim().replace(/,/g, '').match(/(-?[\d.]+)\s*(万|亿|w|k)?/i);
  if (!match) return undefined;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < 0) return undefined;
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === '亿' ? 100_000_000 : unit === '万' || unit === 'w' ? 10_000 : unit === 'k' ? 1000 : 1;
  return Math.round(count * multiplier);
}

/** @param {unknown} value */
export function isArticleDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function localArticleDate(date = new Date()) {
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/**
 * Approximate labels such as weeks/months need an exact source or stored date.
 * @param {unknown} value
 * @param {string | null} [fallback]
 * @param {Date} [now]
 */
export function parseArticleDate(value, fallback, now = new Date()) {
  if (isArticleDate(fallback)) return fallback;
  const label = typeof value === 'string' ? value.trim() : '';
  const today = localArticleDate(now);
  if (!label || !today) return undefined;
  const exact = label.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (exact) {
    const date = `${exact[1]}-${exact[2].padStart(2, '0')}-${exact[3].padStart(2, '0')}`;
    return isArticleDate(date) ? date : undefined;
  }
  const monthDay = label.match(/(?:^|\D)(\d{1,2})[-月](\d{1,2})(?:日|\D|$)/);
  if (monthDay) {
    const suffix = `${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`;
    const year = Number(today.slice(0, 4)) - (suffix > today.slice(5) ? 1 : 0);
    const date = `${year}-${suffix}`;
    return isArticleDate(date) ? date : undefined;
  }
  const elapsed = label.match(/(\d+)\s*(分钟|小时)前/);
  if (elapsed) return localArticleDate(new Date(now.getTime() - Number(elapsed[1]) * (elapsed[2] === '小时' ? 3600_000 : 60_000)));
  if (/今天|刚刚/.test(label)) return today;
  const days = label.includes('前天') ? 2 : label.includes('昨天') ? 1 : Number(label.match(/(\d+)\s*天前/)?.[1]);
  if (!Number.isFinite(days)) return undefined;
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** @param {number | null | undefined} value */
export function formatArticleMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') : '-';
}
