import assert from 'node:assert/strict';
import test from 'node:test';

const targets = [
  { key: 'zhihu', url: 'https://www.zhihu.com/creator/manage/creation/article' },
  { key: 'oschina', url: 'https://my.oschina.net/u/5729420' },
  { key: 'cto', url: 'https://blog.51cto.com/u_17240866' },
  { key: 'toutiao', url: 'https://www.toutiao.com/c/user/token/example/' },
  { key: 'dashboard', url: 'https://ivorysql-dashboard.vercel.app/content' },
];

async function resolver() {
  const helpers = await import('../scripts/ego-content-pages.mjs').catch(() => null);
  assert.equal(typeof helpers?.resolveEgoContentPages, 'function');
  return helpers!.resolveEgoContentPages;
}

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
