import assert from 'node:assert/strict';
import test from 'node:test';
import { collectToutiaoCards } from '../scripts/ego-toutiao.mjs';

const cards = (start: number, end: number) => Array.from({ length: end - start }, (_, index) => ({
  title: `Article ${start + index}`, url: `https://www.toutiao.com/article/${start + index}/`, views: '10',
}));

function feed(frames: ReturnType<typeof cards>[], failure?: Error) {
  let index = 0;
  return {
    evaluate: async (fn: () => unknown) => {
      if (fn.name === 'readToutiaoCards') return frames[index];
      index = Math.min(index + 1, frames.length - 1);
    },
    waitForFunction: async () => { if (failure) throw failure; },
  };
}

test('accumulates an incrementally loaded feed up to exactly 50 articles', async () => {
  const result = await collectToutiaoCards(feed([cards(0, 12), cards(0, 24), cards(0, 36), cards(0, 48), cards(0, 60)]));
  assert.equal(result.length, 50);
  assert.equal(result.at(-1)?.title, 'Article 49');
});

test('keeps earlier cards when the feed virtualizes them out of the DOM', async () => {
  const result = await collectToutiaoCards(feed([cards(0, 12), cards(10, 24), cards(22, 36), cards(34, 48), cards(46, 60)]));
  assert.equal(result.length, 50);
  assert.equal(new Set(result.map((article: { url: string }) => article.url)).size, 50);
});

test('a stalled or login-limited feed fails explicitly instead of claiming success', async () => {
  await assert.rejects(collectToutiaoCards(feed([cards(0, 12)], new Error('Timeout'))), /12\/50.*未写入/);
});

test('user control or browser failures immediately propagate without another scroll', async () => {
  let scrolls = 0;
  await assert.rejects(collectToutiaoCards({
    evaluate: async (fn: () => unknown) => fn.name === 'readToutiaoCards' ? cards(0, 12) : ++scrolls,
    waitForFunction: async () => { throw new Error('Control of this task space is with the user'); },
  }), /Control/);
  assert.equal(scrolls, 1);
});
