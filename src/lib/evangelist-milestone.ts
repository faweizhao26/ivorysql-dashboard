import { isArticleDate } from './content-values.mjs';

export const COMMUNITY_EVANGELIST_POINTS = 100;

export function firstQualificationDate(entries: { date: string | null; points: number }[]): string | null {
  const daily = new Map<string, number>();
  let undated = 0;
  for (const { date, points } of entries) {
    if (date && isArticleDate(date)) daily.set(date, (daily.get(date) ?? 0) + points);
    else undated += points;
  }

  // Credits are nonnegative. A date is certain only when placing all unknown
  // credits before or after the dated history gives the same crossing day.
  let previous = 0;
  for (const [day, points] of [...daily].sort(([a], [b]) => a.localeCompare(b))) {
    if (previous + undated >= COMMUNITY_EVANGELIST_POINTS) return null;
    previous += points;
    if (previous >= COMMUNITY_EVANGELIST_POINTS) return day;
  }
  return null;
}
