import { shiftDate } from './date';
import { isArticleDate } from './content-values.mjs';

export type ReportKind = 'month' | 'quarter' | 'year';

export function reportPeriod(kind: unknown, key: unknown, today: string) {
  if (typeof key !== 'string') throw new RangeError('请选择报告周期');
  const match = (kind === 'month' ? /^([1-9]\d{3})-(0[1-9]|1[0-2])$/
    : kind === 'quarter' ? /^([1-9]\d{3})-Q([1-4])$/ : kind === 'year' ? /^([1-9]\d{3})$/ : /(?!)/
  ).exec(key);
  if (!match) throw new RangeError('报告周期无效');
  const year = Number(match[1]);
  const index = Number(match[2]);
  const month = kind === 'month' ? index : kind === 'quarter' ? index * 3 - 2 : 1;
  const size = kind === 'month' ? 1 : kind === 'quarter' ? 3 : 12;
  const first = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10);
  const start = first(0), plannedEnd = shiftDate(first(size), -1);
  if (start > today || !isArticleDate(plannedEnd)) throw new RangeError('不能生成未来周期的报告');
  const label = year + ' 年' + (kind === 'month' ? ' ' + index + ' 月' : kind === 'quarter' ? '第 ' + index + ' 季度' : '');
  return { kind: kind as ReportKind, key, label, start, end: today < plannedEnd ? today : plannedEnd, plannedEnd, closed: today > plannedEnd, nextEnd: shiftDate(first(2 * size), -1) };
}

export type ReportPeriod = ReturnType<typeof reportPeriod>;
export type ReportRange = { start: string; end: string };
const dayMs = 86_400_000;
const days = ({ start, end }: ReportRange) => (Date.parse(end) - Date.parse(start)) / dayMs + 1;

export function compareReportPeriod(period: ReportPeriod) {
  const months = period.kind === 'month' ? 1 : period.kind === 'quarter' ? 3 : 12;
  const priorStart = new Date(Date.UTC(Number(period.start.slice(0, 4)), Number(period.start.slice(5, 7)) - 1 - months, 1));
  const prior = { start: priorStart.toISOString().slice(0, 10), end: shiftDate(period.start, -1) };
  const count = Math.min(days(period), days(prior));
  return {
    current: { start: period.start, end: period.closed ? period.end : shiftDate(period.start, count - 1) },
    prior: { start: prior.start, end: period.closed ? prior.end : shiftDate(prior.start, count - 1) },
  };
}

export function reportTrendRanges(period: ReportPeriod): ReportRange[] {
  const ranges: ReportRange[] = [];
  for (let start = period.start; start <= period.end;) {
    const next = period.kind === 'month' ? shiftDate(start, 7)
      : new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 1)).toISOString().slice(0, 10);
    ranges.push({ start, end: next > period.end ? period.end : shiftDate(next, -1) });
    start = next;
  }
  return ranges;
}

export function recentlyClosedPeriods(today: string): ReportPeriod[] {
  const month = today.slice(0, 7);
  const previousMonth = shiftDate(month + '-01', -1);
  const quarter = Math.ceil(Number(month.slice(5)) / 3);
  const year = Number(month.slice(0, 4));
  return [
    reportPeriod('month', previousMonth.slice(0, 7), today),
    reportPeriod('quarter', quarter === 1 ? `${year - 1}-Q4` : `${year}-Q${quarter - 1}`, today),
    reportPeriod('year', String(year - 1), today),
  ];
}
