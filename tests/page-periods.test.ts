import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('home and social request actual comparison periods and cancel stale requests', () => {
  for (const page of ['src/app/page.tsx', 'src/app/social/page.tsx']) {
    const source = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.match(source, /fetchMetricPeriods/);
    assert.match(source, /controller\.abort\(\)/);
    assert.match(source, /previous/);
  }
  const social = readFileSync(new URL('../src/app/social/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(social, /fetch\('\/api\/content'/);
});

test('content and GitHub filters discard superseded responses and surface failures', () => {
  for (const page of ['src/app/content/page.tsx', 'src/app/github/page.tsx']) {
    const source = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.match(source, /AbortController/);
    assert.match(source, /\.abort\(\)/);
    assert.match(source, /role="alert"/);
  }
});

test('writes refresh the active content filters instead of their captured old callback', () => {
  const source = readFileSync(new URL('../src/app/content/page.tsx', import.meta.url), 'utf8');
  const writes = source.slice(source.indexOf('async function saveEdit'), source.indexOf('if (loading) return'));
  assert.doesNotMatch(writes, /loadArticles\(\)/);
  assert.match(writes, /setListVersion/);
});

test('home comparison labels retain per-platform fallback dates', () => {
  const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('previous?.freshness?.social[key]'));
  assert.ok(source.includes('previous?.freshness?.articles[key]'));
});
