import { localArticleDate } from './content-values.mjs';

export function getBeijingDate(now: Date = new Date()): string {
  const date = localArticleDate(now);
  if (!date) throw new RangeError('Invalid date');
  return date;
}

// UTC is used only for calendar arithmetic, not to determine today's date.
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
