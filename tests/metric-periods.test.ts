import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMetricPeriods, metricChange } from '../src/lib/metric-periods';

test('comparison loads both exact ranges and forwards the cancellation signal', async () => {
  const signal = new AbortController().signal;
  const urls: string[] = [];
  const result = await fetchMetricPeriods<{ stars: number }>('/api/dashboard',
    { start: '2026-10-11', end: '2026-10-17' }, { start: '2026-10-04', end: '2026-10-10' }, signal,
    (async (url, options) => {
      urls.push(String(url)); assert.equal(options?.signal, signal);
      return Response.json({ stars: String(url).includes('end=2026-10-17') ? 110 : 100 });
    }) as typeof fetch,
  );
  assert.equal(urls.length, 2);
  assert.equal(result.current.stars, 110);
  assert.equal(result.previous?.stars, 100);
  assert.equal(metricChange(110, 100), 10);
  assert.equal(metricChange(110, 0), undefined);
  assert.equal(metricChange(110, undefined), undefined);
});

test('comparison failure preserves current data without inventing a zero baseline', async () => {
  const result = await fetchMetricPeriods('/api/social',
    { start: '2026-10-17', end: '2026-10-17' }, { start: '2025-10-17', end: '2025-10-17' }, new AbortController().signal,
    (async url => String(url).includes('2025') ? Response.json({}, { status: 503 }) : Response.json({ social: [] })) as typeof fetch,
  );
  assert.deepEqual(result.current, { social: [] });
  assert.equal(result.previous, null);
  assert.match(result.comparisonError!, /失败/);
});

test('invalid current dates never reach the network', async () => {
  let calls = 0;
  await assert.rejects(fetchMetricPeriods('/api/social', { start: 'invalid', end: '2026-10-17' }, undefined,
    new AbortController().signal, (async () => { calls++; return Response.json({}); }) as typeof fetch), /Invalid date/);
  assert.equal(calls, 0);
});
