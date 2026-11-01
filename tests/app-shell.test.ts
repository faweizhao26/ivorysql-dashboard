import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInNewContext } from 'node:vm';
import { load } from 'cheerio';

test('theme bootstrap restores valid saved choices before rendering and defaults invalid choices to light', async () => {
  const { THEME_INIT_SCRIPT } = await import('../src/lib/theme');
  for (const [saved, expected] of [[null, 'light'], ['light', 'light'], ['dark', 'dark'], ['broken', 'light']] as const) {
    const element = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(THEME_INIT_SCRIPT, { document: { documentElement: element }, localStorage: { getItem: () => saved } });
    assert.equal(element.dataset.theme, expected);
    assert.equal(element.style.colorScheme, expected);
  }
});

test('blocked storage cannot leave the page without a usable initial theme', async () => {
  const { THEME_INIT_SCRIPT } = await import('../src/lib/theme');
  const element = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  runInNewContext(THEME_INIT_SCRIPT, { document: { documentElement: element }, localStorage: { getItem: () => { throw new Error('Storage unavailable'); } } });
  assert.equal(element.dataset.theme, 'light');
  assert.equal(element.style.colorScheme, 'light');
});

test('sidebar retains the existing destinations and hides the admin link from non-admin sessions', async () => {
  const navigation = await import('../src/components/NavLinks');
  assert.equal(typeof navigation.NavigationLinks, 'function');
  for (const accessLevel of ['viewer', null] as const) {
    const $ = load(renderToStaticMarkup(createElement(navigation.NavigationLinks, { pathname: '/content', accessLevel })));
    assert.deepEqual($('a').map((_, node) => $(node).attr('href')).get(), ['/', '/github', '/social', '/content', '/downloads', '/evangelist', '/events']);
    assert.equal($('a[aria-current="page"]').attr('href'), '/content');
  }
});

test('nested events highlight only events and administrators keep the admin destination', async () => {
  const { NavigationLinks } = await import('../src/components/NavLinks');
  const $ = load(renderToStaticMarkup(createElement(NavigationLinks, { pathname: '/events/38', accessLevel: 'admin' })));
  assert.equal($('a[aria-current="page"]').length, 1);
  assert.equal($('a[aria-current="page"]').attr('href'), '/events');
  assert.equal($('a[href="/admin"]').length, 1);
});
