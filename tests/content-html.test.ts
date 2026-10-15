import assert from 'node:assert/strict';
import test from 'node:test';

async function parsers() {
  const helpers = await import('../src/lib/content-html').catch(() => null);
  assert.equal(typeof helpers?.parseCSDNArticles, 'function');
  return helpers!;
}

test('CSDN metrics keep units and missing counters remain missing', async () => {
  const { parseCSDNArticles } = await parsers();
  const articles = parseCSDNArticles(`<article class="blog-list-box"><a href="https://blog.csdn.net/IvorySQL/article/details/1"><h4>A</h4></a><span class="view-num">1.2万</span><div>博文更新于 2026.10.14 ·</div></article>`);
  assert.equal(articles[0].views, 12000);
  assert.equal(articles[0].date, '2026-10-14');
  assert.equal(articles[0].likes, undefined);
  const missing = parseCSDNArticles(`<article class="blog-list-box"><a href="https://blog.csdn.net/IvorySQL/article/details/2"><h4>B</h4></a></article>`)[0];
  assert.equal(missing.views, undefined);
  assert.equal(missing.date, '');
});

test('cnblogs counters are scoped to each post, with no today or zero fallback', async () => {
  const { parseCnblogsArticles } = await parsers();
  const articles = parseCnblogsArticles(`<div class="day">
    <div class="postTitle"><a class="postTitle2" href="https://www.cnblogs.com/ivorysql/p/1.html"><span>A</span></a></div>
    <div class="postDesc">posted @ 2026-10-12</div>
    <div class="postTitle"><a class="postTitle2" href="https://www.cnblogs.com/ivorysql/p/2.html"><span>B</span></a></div>
    <div class="postDesc">posted @ 2026-10-11 <span class="post-view-count">阅读(2万)</span></div>
  </div>`);
  assert.equal(articles[0].views, undefined);
  assert.equal(articles[0].date, '2026-10-12');
  assert.equal(articles[1].views, 20000);
  assert.equal(articles[1].date, '2026-10-11');
});
