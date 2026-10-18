import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModbAuthorState } from '../src/lib/modb-sync';

function state(total: string, args = '"text,with,(commas)",34,558,113080,306,124,362') {
  return `<script>window.__NUXT__=(function(a,b,c,d,e,f,g){return {data:[{userTotal:{${total}}}]}}(${args}));</script>`;
}

const total = 'follows:b,knowledges:c,totalViews:d,likeds:e,stars:f,commentCount:g';
const expected = { followers: 34, posts: 558, views: 113080, likes: 306, shares: 124, comments: 362, subscribers: 0, video_views: 0 };

test('Modb resolves aliases after quoted arguments containing commas and parentheses', () => {
  assert.deepEqual(parseModbAuthorState(state(total)), expected);
});

test('Modb handles nested literal arguments and escaped text without shifting aliases', () => {
  assert.deepEqual(parseModbAuthorState(state(total, '{text:"a,\\\"b)"},34,558,113080,306,124,362')), expected);
});

test('Modb accepts spaced and quoted state keys', () => {
  const html = `<script>window.__NUXT__ = (function(a,b,c,d,e,f,g) { return {data:[{"userTotal": {"follows":b,"knowledges":c,"totalViews":d,"likeds":e,"stars":f,"commentCount":g}}]}; }("a,b",34,558,113080,306,124,362));</script>`;
  assert.deepEqual(parseModbAuthorState(html), expected);
});

test('Modb keeps genuine zero posts rather than substituting contents', () => {
  assert.equal(parseModbAuthorState(state(`${total},contents:99`, 'null,0,0,0,0,0,0'))?.posts, 0);
});

test('Modb supports contents when knowledges is absent', () => {
  assert.deepEqual(parseModbAuthorState(state(total.replace('knowledges:c', 'contents:c'))), expected);
});

for (const field of ['follows', 'knowledges', 'totalViews', 'likeds', 'stars', 'commentCount']) {
  for (const invalid of ['missingAlias', 'null', 'false', '""', '"123"', '1/0', '-1', '1.5', '9007199254740992']) {
    test(`Modb rejects invalid required ${field}: ${invalid}`, () => {
      const badTotal = total.replace(new RegExp(`${field}:\\w+`), `${field}:${invalid}`);
      assert.throws(() => parseModbAuthorState(state(badTotal)), new RegExp(field));
    });
  }
  test(`Modb rejects missing required ${field}`, () => {
    const missing = total.split(',').filter(value => !value.startsWith(`${field}:`)).join(',');
    assert.throws(() => parseModbAuthorState(state(missing)), new RegExp(field === 'knowledges' ? 'knowledges|contents' : field));
  });
}

test('Modb does not execute argument expressions or body side effects', () => {
  const target = globalThis as typeof globalThis & { modbExecuted?: boolean };
  delete target.modbExecuted;
  const html = state(total, '"a,b",(globalThis.modbExecuted=true,34),558,113080,306,124,362');
  assert.throws(() => parseModbAuthorState(html), /follows/);
  assert.equal(target.modbExecuted, undefined);
});

test('Modb rejects truncated Nuxt state instead of returning zero metrics', () => {
  assert.throws(() => parseModbAuthorState(`<script>window.__NUXT__=(function(){return {userTotal:{${total}}`), /Nuxt|NUXT/);
});
