import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDashboardClient } from '../scripts/ego-dashboard-client.mjs';

const source = readFileSync(new URL('../scripts/sync-ego-content.mjs', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function runScript(taskSpace: (id?: number) => Promise<unknown>, env: Record<string, string> = {}, extraEnv = '') {
  const requests: { url: string; body?: { platform: string; status?: string; articles?: unknown[] } }[] = [];
  const logs: { platform: string; success: boolean; articles?: number }[] = [];
  const processMock: { env: Record<string, string>; exitCode?: number } = { env: { ...env } };
  async function importModule(specifier: string) {
    if (specifier === 'node:fs/promises') return {
      readFile: async () => 'ADMIN_PASSWORD=test-only\nEGO_DASHBOARD_BASE=https://staging.example\n' + extraEnv,
      access: async () => { throw new Error('no dry-run marker'); },
    };
    if (specifier.endsWith('ego-dashboard-client.mjs')) return {
      ...await import('../scripts/ego-dashboard-client.mjs'),
      createDashboardClient: (options: Parameters<typeof createDashboardClient>[0]) => createDashboardClient({
        ...options,
        fetchImpl: async (url, init = {}) => {
          const body = init.body ? JSON.parse(String(init.body)) : undefined;
          requests.push({ url: String(url), body });
          return Response.json({ success: true, version: 1, dates: [], articles: body?.articles?.length, runId: 1 });
        },
      }),
    };
    return import(specifier);
  }
  await new AsyncFunction('taskSpace', 'process', 'importModule', 'console', source.replaceAll('await import(', 'await importModule('))(
    taskSpace, processMock, importModule,
    { log: (line: string) => logs.push(JSON.parse(line)), error: (line: string) => logs.push(JSON.parse(line)) },
  );
  return { requests, logs, exitCode: processMock.exitCode };
}

test('env file selects the destination before preflight and missing workspace failures are all recorded', async () => {
  let attempts = 0;
  const result = await runScript(async () => { attempts += 1; throw new Error('TaskSpace 28 missing'); });
  assert.ok(result.requests.every(request => request.url.startsWith('https://staging.example/')));
  assert.equal(attempts, 1);
  assert.equal(result.requests.filter(request => request.body?.status === 'failed').length, 4);
  assert.equal(result.logs.filter(result => !result.success).length, 4);
  assert.equal(result.exitCode, 1);
});

test('workspace configuration overrides a stale browser process environment', async () => {
  let selected: number | undefined;
  await runScript(async id => { selected = id; throw new Error('read-only missing workspace'); },
    { EGO_TASK_SPACE_ID: '7' }, 'EGO_TASK_SPACE_ID=11\nEGO_TASK_SPACE_NAME="IvorySQL collection"');
  assert.equal(selected, 11);
});

test('a missing platform tab does not block the remaining configured platform', async () => {
  let handedOff = 0;
  const url = 'https://www.zhihu.com/creator/manage/creation/article';
  const page = {
    goto: async () => {}, url: async () => url,
    fetch: async () => ({ ok: true, body: JSON.stringify({ data: Array.from({ length: 50 }, (_, index) => ({ data: { title: `article ${index}`, url_token: index, created_time: 1792108800 }, reaction: { read_count: 100 } })), paging: { is_end: true } }) }),
  };
  const result = await runScript(async () => ({
    spaceId: 28, tabs: async () => [{ url, label: 'p6' }], page: () => page,
    handOff: async () => { handedOff += 1; },
  }));
  assert.deepEqual(result.logs.find(result => result.platform === 'zhihu'), { platform: 'zhihu', success: true, articles: 50 });
  assert.equal(result.requests.filter(request => request.body?.status === 'failed').length, 3);
  assert.equal(handedOff, 1);
});
