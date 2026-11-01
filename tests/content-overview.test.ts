import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

const summaries = [
  { platform: 'wechat', article_count: 633, total_views: 146138, data_date: '2026-08-31', updated_at: '2026-10-20T01:00:00Z' },
  { platform: 'cnblogs', article_count: 441, total_views: 21238, data_date: '2026-10-16', updated_at: '2026-10-20T02:00:00Z' },
  { platform: 'zhihu', article_count: 496, total_views: 0, data_date: '2026-10-16', updated_at: '2026-10-20T01:00:00Z' },
];

test('home and content share publication-range summaries of current article reads', () => {
  for (const file of ['src/app/page.tsx', 'src/app/content/page.tsx']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /useContentOverview/);
    assert.match(source, /ContentPlatformCards/);
  }
  const home = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /articleData\[key\]|previousArticles\[key\]/);
  assert.match(home, /useContentOverview\(dateRange\)/);
  assert.match(home, /发布日期/);
});

test('the shared overview requests the same endpoint without date filtering or cached totals', async () => {
  const { fetchContentOverview } = await import('../src/lib/content-overview');
  const controller = new AbortController();
  let requested: { url: string; init?: RequestInit } | undefined;
  const expected = { platforms: summaries, updated_at: '2026-10-20T02:00:00Z' };
  const result = await fetchContentOverview(controller.signal, async (input, init) => {
    requested = { url: String(input), init };
    return Response.json(expected);
  });
  assert.deepEqual(result, expected);
  assert.equal(requested?.url, '/api/content');
  assert.equal(requested?.init?.credentials, 'include');
  assert.equal(requested?.init?.cache, 'no-store');
  assert.equal(requested?.init?.signal, controller.signal);
});

test('range-aware overview requests and CSV preserve the selected publication dates', async () => {
  const { fetchContentOverview, contentOverviewExportRows } = await import('../src/lib/content-overview');
  const range = { start: '2026-10-14', end: '2026-10-20' };
  let requested = '';
  await fetchContentOverview(undefined, async input => {
    requested = String(input);
    return Response.json({ platforms: summaries, updated_at: null });
  }, range);
  assert.equal(requested, '/api/content?start=2026-10-14&end=2026-10-20');
  const rows = contentOverviewExportRows(summaries, range);
  assert.equal(rows[0].时间段, '2026-10-14 ~ 2026-10-20');
  assert.equal(rows[0].统计口径, '按发布日期 · 当前累计阅读');
});

test('home platform cards carry the selected publication range into the content page', async () => {
  const { ContentPlatformCards } = await import('../src/components/ContentPlatformCards');
  const html = load(renderToStaticMarkup(createElement(ContentPlatformCards, { summaries, dateRange: { start: '2026-10-14', end: '2026-10-20' } })));
  const url = new URL(html('[data-content-platform="csdn"]').attr('href')!, 'http://localhost');
  assert.equal(url.searchParams.get('platform'), 'csdn');
  assert.equal(url.searchParams.get('start'), '2026-10-14');
  assert.equal(url.searchParams.get('end'), '2026-10-20');
});

test('failed overview requests remain errors rather than becoming zero article counts', async () => {
  const { fetchContentOverview } = await import('../src/lib/content-overview');
  await assert.rejects(fetchContentOverview(undefined, async () => Response.json({ error: 'unavailable' }, { status: 503 })), /平台汇总加载失败/);
  await assert.rejects(fetchContentOverview(undefined, async () => Response.json({ platforms: null })), /平台汇总/);
});

test('platform links, selector and CSV resolve to the same channels including WeChat and cnblogs', async () => {
  const { CONTENT_PLATFORMS, resolveContentPlatform, contentOverviewExportRows } = await import('../src/lib/content-overview');
  assert.ok(CONTENT_PLATFORMS.some(platform => platform.key === 'wechat'));
  assert.ok(CONTENT_PLATFORMS.some(platform => platform.key === 'cnblogs'));
  for (const platform of CONTENT_PLATFORMS) assert.equal(resolveContentPlatform(platform.key), platform.key);
  for (const value of [null, '', 'invalid', 'javascript:alert(1)']) assert.equal(resolveContentPlatform(value), 'wechat');
  const rows = contentOverviewExportRows(summaries);
  assert.equal(rows[0].平台, '公众号');
  assert.equal(rows[0].文章数, 633);
  assert.equal(rows[0].阅读量, 146138);
  assert.equal(rows[0].统计口径, '最新累计');
  assert.equal(rows.find(row => row.平台 === '知乎')?.阅读量, 0);
});

test('home links and content selectors render identical platform metrics and preserve missing versus zero', async () => {
  const { ContentPlatformCards } = await import('../src/components/ContentPlatformCards');
  const home = load(renderToStaticMarkup(createElement(ContentPlatformCards, { summaries })));
  const content = load(renderToStaticMarkup(createElement(ContentPlatformCards, { summaries, selectedPlatform: 'cnblogs', onSelect() {} })));
  const homeCards = home('[data-content-platform]');
  assert.equal(homeCards.length, content('[data-content-platform]').length);
  homeCards.each((_, card) => {
    const key = home(card).attr('data-content-platform');
    assert.equal(home(card).attr('href'), `/content?platform=${key}`);
    assert.equal(home(card).text(), content(`[data-content-platform="${key}"]`).text());
  });
  assert.equal(content('[data-content-platform="cnblogs"]').attr('aria-pressed'), 'true');
  assert.equal(content('[data-content-platform="wechat"]').attr('aria-pressed'), 'false');
  assert.equal(home('[data-content-platform="wechat"] dd').first().text(), '633');
  assert.equal(home('[data-content-platform="zhihu"] dd').last().text(), '0');
  assert.equal(home('[data-content-platform="csdn"] dd').first().text(), '-');
});

test('content selection follows the URL so home links and browser navigation select the requested platform', () => {
  const source = readFileSync(new URL('../src/app/content/page.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.FunctionDeclaration | undefined;
  function find(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'selectPlatform') handler = node;
    ts.forEachChild(node, find);
  }
  find(ast);
  assert.ok(handler);
  const code = ts.transpileModule(handler.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let page = 4;
  let href = '/content?platform=wechat&start=2026-10-01&end=2026-10-07';
  const select = runInNewContext(`${code}; selectPlatform`, {
    URLSearchParams,
    searchParams: new URLSearchParams('platform=wechat&start=2026-10-01&end=2026-10-07'),
    setPage: (value: number) => { page = value; },
    window: { history: { pushState: (_state: unknown, _title: string, url: string) => { href = url; } } },
  });
  select('zhihu');
  assert.equal(page, 1);
  assert.equal(href, '/content?platform=zhihu&start=2026-10-01&end=2026-10-07');
});

test('manual and archived cards show data update times instead of historical collection times', async () => {
  const { ContentPlatformCards } = await import('../src/components/ContentPlatformCards');
  const { formatLastUpdated } = await import('../src/components/LastUpdated');
  const updatedAt = '2026-10-31T01:00:00Z';
  const collectedAt = '2026-10-01T01:00:00Z';
  const rows = ['wechat', 'oschina', 'ctoutiao', 'toutiao', 'zhihu', 'juejin', 'csdn'].map(platform => ({
    platform, article_count: 50, total_views: 500, data_date: null, updated_at: updatedAt,
    sync: { status: 'success' as const, last_success_at: collectedAt, last_attempt_at: collectedAt },
  }));
  const html = load(renderToStaticMarkup(createElement(ContentPlatformCards, { summaries: rows })));
  for (const { platform } of rows.filter(row => row.platform !== 'csdn')) {
    const card = html(`[data-content-platform="${platform}"]`).text();
    assert.match(card, platform === 'juejin' ? /历史保留/ : /手动更新/);
    assert.ok(card.includes(`更新：${formatLastUpdated(updatedAt)}`));
    assert.doesNotMatch(card, /采集：|采集已过期|采集正常/);
  }
  assert.ok(html('[data-content-platform="csdn"]').text().includes(`采集：${formatLastUpdated(collectedAt)}`));
  const missing = load(renderToStaticMarkup(createElement(ContentPlatformCards, { summaries: [{ ...rows[1], updated_at: null }] })));
  assert.doesNotMatch(missing('[data-content-platform="oschina"]').text(), /采集：|更新：/);
});

test('CSV marks cancelled collection as manual and keeps its last success explicitly historical', async () => {
  const { contentOverviewExportRows } = await import('../src/lib/content-overview');
  const sync = { status: 'failed' as const, last_success_at: '2026-10-01T01:00:00Z', last_attempt_at: '2026-10-02T01:00:00Z' };
  const rows = contentOverviewExportRows(summaries.map(row => ({ ...row, sync })));
  const manual = rows.find(row => row.平台 === '知乎')!;
  assert.equal(manual.采集状态, '手动更新');
  assert.equal(manual.数据更新, summaries[2].updated_at);
  assert.equal(manual['最近成功采集（历史）'], sync.last_success_at);
  assert.equal(rows.find(row => row.平台 === '博客园')?.采集状态, '最近采集失败');
});
