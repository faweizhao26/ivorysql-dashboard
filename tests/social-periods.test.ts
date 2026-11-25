import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Pool } from 'pg';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET } from '../src/app/api/social/route';
import { PlatformMetrics } from '../src/app/social/PlatformMetrics';
import type { SocialStats } from '../src/lib/db';
import { createDataSlice, type DataSlice } from '../src/lib/data-slices';

function snapshot(platform: string, date: string, followers: number): SocialStats {
  return { platform, date, followers, subscribers: 0, posts: 10, views: 200,
    video_views: 0, likes: 0, shares: 0, comments: 0 };
}

function mockSnapshots(t: TestContext, rows: SocialStats[]) {
  t.mock.method(Pool.prototype, 'connect', async () => ({
    query: async () => ({ rows: [] }), release() {},
  }));
  t.mock.method(Pool.prototype, 'query', async (sql: string, [start, end, platform]: string[] = []) => {
    if (sql.includes('SELECT DISTINCT platform')) {
      return { rows: [...new Set(rows.map(r => r.platform))].map(platform => ({ platform })) };
    }
    if (sql.includes('DISTINCT ON (platform)')) {
      return { rows: [...new Map(rows.filter(r => r.date <= start).map(r => [r.platform, r])).values()] };
    }
    assert.match(sql, /FROM social_stats WHERE date >= \$1 AND date <= \$2/);
    return { rows: rows.filter(r => r.date >= start && r.date <= end && (!platform || r.platform === platform)) };
  });
}

async function period(start: string, end: string) {
  const response = await GET(new Request(`http://localhost/api/social?start=${start}&end=${end}`));
  assert.equal(response.status, 200);
  return await response.json() as { social: SocialStats[]; freshness: Record<string, DataSlice<SocialStats>> };
}

function renderMetrics(current: DataSlice<SocialStats>, previous: DataSlice<SocialStats>) {
  return renderToStaticMarkup(createElement(PlatformMetrics, { current, previous, compare: true, accent: '#07C160' }));
}

test('two empty weeks display the same older snapshot without marking either week as a hit', async t => {
  const old = snapshot('wechat', '2026-11-08', 120);
  const first = snapshot('youtube', '2026-11-09', 80);
  const second = snapshot('youtube', '2026-11-22', 80);
  mockSnapshots(t, [old, first, second]);
  const previous = await period('2026-11-09', '2026-11-15');
  const current = await period('2026-11-16', '2026-11-22');
  for (const [result, exact] of [[previous, first], [current, second]] as const) {
    assert.deepEqual(result.social, [old, exact]);
    assert.equal(result.freshness.wechat.data_date, old.date);
    assert.equal(result.freshness.wechat.has_exact_data, false);
    assert.deepEqual(result.freshness.youtube.data, exact);
    assert.equal(result.freshness.youtube.has_exact_data, true);
  }
  const stale = renderMetrics(current.freshness.wechat, previous.freshness.wechat);
  assert.match(stale, />120</);
  assert.match(stale, /区间内无快照，最新可用数据：2026-11-08/);
  assert.doesNotMatch(stale, /%/);
  const flat = renderMetrics(current.freshness.youtube, previous.freshness.youtube);
  assert.equal(flat.match(/>0\.0%</g)?.length, 3);
});

test('neither period can supply a fallback operand, even if the two snapshot dates differ', () => {
  const older = snapshot('wechat', '2026-11-08', 100);
  const newer = snapshot('wechat', '2026-11-16', 125);
  const exact = (row: SocialStats) => createDataSlice(undefined, row, null);
  const fallback = (row: SocialStats) => createDataSlice(undefined, null, row);
  for (const html of [
    renderMetrics(fallback(newer), exact(older)),
    renderMetrics(exact(newer), fallback(older)),
    renderMetrics(exact(newer), exact(newer)),
  ]) {
    assert.match(html, />125</);
    assert.doesNotMatch(html, /%/);
  }
  assert.match(renderMetrics(exact(newer), exact(older)), /\+25\.0%/);
});
