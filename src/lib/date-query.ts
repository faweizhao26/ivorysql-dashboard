import { getBeijingDate, shiftDate } from './date';

export interface DataRangeParams {
  startDate: string;
  endDate: string;
  isSingleDay: boolean;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getDataRangeParams(searchParams: URLSearchParams, today: string = getBeijingDate()): DataRangeParams {
  const endDate = searchParams.get('end') || today;
  const startParam = searchParams.get('start');
  if (!isIsoDate(endDate) || (startParam && !isIsoDate(startParam))) {
    throw new RangeError('Invalid date; expected YYYY-MM-DD');
  }

  let startDate: string;
  if (startParam) {
    startDate = startParam;
  } else {
    const daysText = searchParams.get('days') || '30';
    const days = Number(daysText);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new RangeError('Invalid days; expected an integer from 1 to 3650');
    }
    startDate = shiftDate(endDate, -days);
  }

  if (startDate > endDate) throw new RangeError('start must be before or equal to end');
  return { startDate, endDate, isSingleDay: Boolean(startParam) && startDate === endDate };
}
