import assert from 'node:assert/strict';
import test from 'node:test';

const targets = [
  { key: 'zhihu', url: 'https://www.zhihu.com/creator/manage/creation/article' },
  { key: 'oschina', url: 'https://my.oschina.net/u/5729420' },
  { key: 'cto', url: 'https://blog.51cto.com/u_17240866' },
  { key: 'toutiao', url: 'https://www.toutiao.com/c/user/token/example/' },
  { key: 'dashboard', url: 'https://ivorysql-dashboard.vercel.app/content' },
];

test('reuses the approved retained workspace without creating another space', async () => {
  const helpers = await import('../scripts/ego-content-pages.mjs');
  assert.equal(typeof helpers.openEgoContentTask, 'function');
  const calls: string[] = [];
  const api = {
    listTaskSpaces: async () => [{ id: 11, name: 'IvorySQL collection', ownership: 'user' }],
    claimTaskSpace: async (id: number) => { calls.push(`claim:${id}`); return { spaceId: id }; },
    taskSpace: async (id: number) => { calls.push(`open:${id}`); return { spaceId: id }; },
  };
  assert.deepEqual(await helpers.openEgoContentTask(11, api, 'IvorySQL collection'), { spaceId: 11 });
  assert.deepEqual(calls, ['claim:11']);
  calls.length = 0;
  await assert.rejects(helpers.openEgoContentTask(12, api), /不存在/);
  await assert.rejects(helpers.openEgoContentTask(11, api, 'another workspace'), /名称/);
  assert.deepEqual(calls, []);
});

async function resolver() {
  const helpers = await import('../scripts/ego-content-pages.mjs').catch(() => null);
  assert.equal(typeof helpers?.resolveEgoContentPages, 'function');
  return helpers!.resolveEgoContentPages;
}

test('takes back a handed-off dedicated space and safely resolves a changed ID by unique exact name', async () => {
  const { openEgoContentTask } = await import('../scripts/ego-content-pages.mjs');
  const calls: string[] = [];
  const api = {
    listTaskSpaces: async () => [{ id: 42, name: 'IvorySQL collection', ownership: 'agentDelegatedToUser' }],
    takeOverTaskSpace: async (id: number) => { calls.push(`take:${id}`); return { spaceId: id }; },
    taskSpace: async () => { throw new Error('Must take back before using space'); },
  };
  assert.deepEqual(await openEgoContentTask(17, api, 'IvorySQL collection'), { spaceId: 42 });
  assert.deepEqual(calls, ['take:42']);
  await assert.rejects(openEgoContentTask(17, { ...api, listTaskSpaces: async () => [{ id: 17, name: 'Other project', ownership: 'user' }] }, 'IvorySQL collection'), /名称/);
  await assert.rejects(openEgoContentTask(17, { ...api, listTaskSpaces: async () => [{ id: 41, name: 'IvorySQL collection' }, { id: 42, name: 'IvorySQL collection' }] }, 'IvorySQL collection'), /多个|唯一/);
});

test('resolves live pages by URL when persistent page labels change', async () => {
  const resolve = await resolver();
  const tabs = targets.map((target, index) => ({ label: `p${index + 6}`, url: target.url, page: {} }));
  tabs[2].url += '/p_2';
  tabs[4].url = 'https://ivorysql-dashboard.vercel.app/events';
  const calls: string[] = [];
  const pages = await resolve({
    tabs: async () => tabs,
    page: (label: string) => { calls.push(label); return { label }; },
  }, targets);
  assert.deepEqual(calls, ['p6', 'p7', 'p8', 'p9', 'p10']);
  assert.equal(pages.zhihu.label, 'p6');
  assert.equal(pages.dashboard.label, 'p10');
});

test('prefers the expected path when more than one page has the same origin', async () => {
  const resolve = await resolver();
  const pages = await resolve({
    tabs: async () => [
      { label: 'p20', url: 'https://www.zhihu.com/explore' },
      { label: 'p21', url: targets[0].url },
    ],
    page: (label: string) => ({ label }),
  }, [targets[0]]);
  assert.equal(pages.zhihu.label, 'p21');
});

test('missing pages fail before binding and lookalike hosts are not accepted', async () => {
  const resolve = await resolver();
  let bound = 0;
  await assert.rejects(resolve({
    tabs: async () => [
      { label: 'p6', url: targets[0].url },
      { label: 'p7', url: 'https://my.oschina.net.example.com/u/5729420' },
      { label: 'p8', url: 'not a URL' },
    ],
    page: () => { bound += 1; },
  }, targets.slice(0, 2)), /oschina.*页面/);
  assert.equal(bound, 0);
});

test('adopts an existing unlabelled page without creating new tabs', async () => {
  const resolve = await resolver();
  const existing = { existing: true };
  const pages = await resolve({
    tabs: async () => [{ url: targets[0].url, page: existing }],
    adopt: async (page: object) => { assert.equal(page, existing); return { label: 'p22' }; },
  }, [targets[0]]);
  assert.equal(pages.zhihu.label, 'p22');
});
