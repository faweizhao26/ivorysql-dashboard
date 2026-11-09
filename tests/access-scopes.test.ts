import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { safeReturnPath } from '../src/lib/session-response';
import { NavigationLinks } from '../src/components/NavLinks';
import * as auth from '../src/lib/auth';

test('passwords resolve to separate scopes and missing or colliding full-viewer secrets never escalate old passwords', () => {
  const passwords = { accessPassword: 'old', adminPassword: 'admin', viewerPassword: 'new' };
  assert.equal(auth.resolvePasswordAccess('old', passwords), 'evangelist');
  assert.equal(auth.resolvePasswordAccess('new', passwords), 'viewer');
  assert.equal(auth.resolvePasswordAccess('admin', passwords), 'admin');
  assert.equal(auth.resolvePasswordAccess('', passwords), null);
  assert.equal(auth.resolvePasswordAccess(undefined, passwords), null);
  assert.equal(auth.resolvePasswordAccess('old', { ...passwords, viewerPassword: 'old' }), 'evangelist');
  assert.equal(auth.resolvePasswordAccess('', { ...passwords, viewerPassword: undefined }), null);
});

test('restricted logins land on evangelist even when login was opened from a different page', () => {
  for (const path of [null, '/', '/admin', '/content?platform=zhihu', '//example.com']) {
    assert.equal(safeReturnPath(path, 'evangelist'), '/evangelist');
  }
  assert.equal(safeReturnPath('/content?platform=zhihu', 'viewer'), '/content?platform=zhihu');
});

test('restricted navigation exposes only the evangelist destination', () => {
  const html = load(renderToStaticMarkup(createElement(NavigationLinks, { pathname: '/evangelist', accessLevel: 'evangelist' })));
  assert.deepEqual(html('a').map((_, el) => html(el).attr('href')).get(), ['/evangelist']);
});
