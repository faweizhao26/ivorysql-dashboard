import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArticleDetailsInput } from '../src/app/api/articles/route';

test('preserves content category and source when parsing new article input', () => {
  const parsed = parseArticleDetailsInput({
    date: '2026-07-22',
    platform: 'wechat',
    article_title: 'IvorySQL update',
    article_url: 'https://example.com/post',
    views: 12,
    likes: 3,
    comments: 1,
    content_category: '社区新闻动态',
    content_source: '社区',
  });

  assert.equal(parsed.content_category, '社区新闻动态');
  assert.equal(parsed.content_source, '社区');
});
