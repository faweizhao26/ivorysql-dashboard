const EVENT_TYPES = new Set(['conference','meetup','webinar','workshop','hackathon','campus','campaign','other']);
export function parseEventId(value: string): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) throw new RangeError('Invalid event id');
  return id;
}
export function parseEventListParams(searchParams: URLSearchParams) {
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '100');
  const year = searchParams.get('year')?.trim() || undefined;
  const type = searchParams.get('type')?.trim() || undefined;
  const search = searchParams.get('search')?.trim().slice(0,100) || undefined;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new RangeError('Invalid page');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError('Invalid pageSize; expected 1 to 100');
  if (year && !/^\d{4}$/.test(year)) throw new RangeError('Invalid year');
  if (type && !EVENT_TYPES.has(type)) throw new RangeError('Invalid event type');
  return { page, pageSize, year, type, search };
}
