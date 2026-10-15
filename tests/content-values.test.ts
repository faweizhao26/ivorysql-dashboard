import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMetric, prepareRecentArticles } from '../src/lib/content-sync';

async function values() {
  const helpers = await import('../src/lib/content-values.mjs').catch(() => null);
  assert.equal(typeof helpers?.parseArticleDate, 'function');
  return helpers!;
}

test('browser reading labels preserve units and missing values are not zero', () => {
  assert.equal(normalizeMetric('1.2万阅读'), 12000);
  assert.equal(normalizeMetric('阅读 2万'), 20000);
  assert.equal(normalizeMetric('1,234 阅读'), 1234);
  assert.equal(normalizeMetric('0 阅读'), 0);
  assert.equal(normalizeMetric('暂未展示'), undefined);
  assert.equal(normalizeMetric(null), undefined);
  assert.equal(normalizeMetric(-1), undefined);
});

test('unrecognized or approximate dates never become today', async () => {
  const { parseArticleDate } = await values();
  const now = new Date('2026-10-15T01:00:00Z');
  for (const label of ['', '3周前', '2个月前', '未知', '2026-02-30']) {
    assert.equal(parseArticleDate(label, undefined, now), undefined);
  }
  assert.equal(parseArticleDate('3周前', '2026-09-24', now), '2026-09-24');
  assert.equal(parseArticleDate('2026年9月1日', undefined, now), '2026-09-01');
  assert.equal(parseArticleDate('昨天', undefined, now), '2026-10-14');
  assert.equal(parseArticleDate('前天', undefined, now), '2026-10-13');
  assert.equal(parseArticleDate('3天前', undefined, now), '2026-10-12');
  assert.equal(parseArticleDate('今天', undefined, now), '2026-10-15');
  assert.equal(parseArticleDate('10-20', undefined, now), '2025-10-20');
});

test('article day and relative times use Shanghai rather than the host timezone', async () => {
  const { localArticleDate, parseArticleDate } = await values();
  const now = new Date('2026-10-14T17:00:00Z');
  assert.equal(localArticleDate(now), '2026-10-15');
  assert.equal(parseArticleDate('2小时前', undefined, now), '2026-10-14');
});

test('unknown reading counts display a placeholder while a real zero stays zero', async () => {
  const { formatArticleMetric } = await values();
  assert.equal(formatArticleMetric(null), '-');
  assert.equal(formatArticleMetric(undefined), '-');
  assert.equal(formatArticleMetric(0), '0');
  assert.equal(formatArticleMetric(12000), '12,000');
});

test('automatic writes reject missing or invalid publication dates before saving', () => {
  for (const date of ['', '2026-02-30', 'not a date']) {
    assert.throws(() => prepareRecentArticles([{ title: 'A', url: 'https://example.com/a', date }]), /date/i);
  }
});
