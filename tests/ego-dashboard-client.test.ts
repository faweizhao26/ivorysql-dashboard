import assert from 'node:assert/strict';
import test from 'node:test';
import { createDashboardClient, runCollectors } from '../scripts/ego-dashboard-client.mjs';

test('dashboard reads and writes use machine auth without cookies', async () => {
  const requests: { url: string; options: RequestInit }[] = [];
  const client = createDashboardClient({ baseUrl: 'https://dashboard.test', adminPassword: 'test-only', fetchImpl: async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return Response.json({ success: true, version: 1, dates: [['url', '2026-01-01']] });
  } });
  await client.preflight();
  assert.deepEqual(await client.existingDates('toutiao'), new Map([['url', '2026-01-01']]));
  await client.upload('zhihu', [{ title: 'test' }]);
  await client.reportFailure('zhihu', new Error('login expired'));
  assert.equal(requests.length, 4);
  for (const { url, options } of requests) {
    assert.match(url, /^https:\/\/dashboard.test\/api\/browser-content\/sync/);
    assert.match((options.headers as Record<string, string>).Authorization, /^Bearer browser-sync-v1\./);
    assert.equal((options.headers as Record<string, string>).Cookie, undefined);
    assert.equal(options.redirect, 'manual');
  }
  assert.deepEqual(JSON.parse(requests[3].options.body as string), { platform: 'zhihu', status: 'failed', error: 'login expired' });
});

test('preflight clearly rejects expired auth, redirects and undeployed endpoints', async () => {
  for (const [status, message] of [[401, /认证失败/], [307, /认证失败/], [405, /尚未部署/]] as const) {
    const client = createDashboardClient({ baseUrl: 'https://dashboard.test', adminPassword: 'test-only', fetchImpl: async () => new Response('', { status }) });
    await assert.rejects(client.preflight(), error => error instanceof Error && 'fatal' in error && error.fatal === true && message.test(error.message));
  }
});

test('prefers scoped short-lived credentials even when a cron secret also exists', async () => {
  let authorization = '';
  const client = createDashboardClient({ baseUrl: 'https://dashboard.test', adminPassword: 'test-only', cronSecret: 'broad-cron-secret', fetchImpl: async (_url, options = {}) => {
    authorization = (options.headers as Record<string, string>).Authorization;
    return Response.json({ success: true, version: 1 });
  } });
  await client.preflight();
  assert.match(authorization, /^Bearer browser-sync-v1\./);
});

test('collector errors are reported once, while shared auth failures stop remaining work', async () => {
  const seen: string[] = [];
  const reported: string[] = [];
  const collectors = [
    ['oschina', async () => { seen.push('oschina'); throw new Error('page changed'); }],
    ['ctoutiao', async () => { seen.push('ctoutiao'); throw Object.assign(new Error('auth expired'), { fatal: true }); }],
    ['zhihu', async () => { seen.push('zhihu'); return []; }],
  ];
  const results = await runCollectors(collectors, async () => ({}), async (platform: string) => { reported.push(platform); });
  assert.deepEqual(seen, ['oschina', 'ctoutiao']);
  assert.deepEqual(reported, ['oschina']);
  assert.equal(results.length, 2);
  assert.ok(results.every((result: { success: boolean }) => !result.success));
});

test('server-recorded failures are not recorded a second time', async () => {
  let reports = 0;
  const results = await runCollectors([['zhihu', async () => []]], async () => {
    throw Object.assign(new Error('database failed'), { recorded: true });
  }, async () => { reports += 1; });
  assert.equal(results[0].success, false);
  assert.equal(reports, 0);
});

test('a declined failure report is not presented as saved', async () => {
  const results = await runCollectors([['zhihu', async () => { throw new Error('page changed'); }]], async () => ({}), async () => false);
  assert.equal(results[0].failureRecorded, false);
});

test('explicit browser user takeover stops immediately without remote writes or other platform work', async () => {
  let nextCalls = 0;
  let writes = 0;
  const results = await runCollectors([
    ['oschina', async () => { throw new Error('User is taking control of this task space'); }],
    ['zhihu', async () => { nextCalls += 1; return []; }],
  ], async () => { writes += 1; }, async () => { writes += 1; });
  assert.equal(nextCalls, 0);
  assert.equal(writes, 0);
  assert.equal(results.length, 1);
  assert.equal(results[0].stopped_for_user, true);
});
