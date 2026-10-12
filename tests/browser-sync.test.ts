import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isBrowserSyncAuthorized,
  parseBrowserSyncPayload,
} from '../src/lib/browser-sync';

test('accepts browser metrics only for configured platforms', () => {
  const parsed = parseBrowserSyncPayload({
    platform: 'zhihu',
    articles: [{
      title: 'IvorySQL article',
      url: 'https://zhuanlan.zhihu.com/p/1',
      date: '2026-10-12',
      views: '25',
      likes: 2,
      comments: 1,
    }],
  });

  assert.deepEqual(parsed, {
    platform: 'zhihu',
    articles: [{
      title: 'IvorySQL article',
      url: 'https://zhuanlan.zhihu.com/p/1',
      date: '2026-10-12',
      views: 25,
      likes: 2,
      comments: 1,
    }],
  });
  assert.throws(() => parseBrowserSyncPayload({ platform: 'juejin', articles: [] }));
});

test('requires the exact cron bearer token for browser imports', () => {
  assert.equal(isBrowserSyncAuthorized('Bearer correct', 'correct'), true);
  assert.equal(isBrowserSyncAuthorized('Bearer wrong', 'correct'), false);
  assert.equal(isBrowserSyncAuthorized(null, 'correct'), false);
});
