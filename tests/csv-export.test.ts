import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { downloadCSV } from '../src/lib/csv-utils';

function downloads(t: TestContext) {
  const blobs: Blob[] = [];
  const revoked: string[] = [];
  const link = { href: '', download: '', clicks: 0, click() { this.clicks++; } };
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => { blobs.push(blob); return 'blob:test-csv'; });
  t.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { createElement(tag: string) { assert.equal(tag, 'a'); return link; } },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  return {
    blobs, revoked, link,
    async content() {
      assert.equal(blobs.length, 1);
      const bytes = new Uint8Array(await blobs[0].arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
      assert.equal(blobs[0].type, 'text/csv;charset=utf-8;');
      return new TextDecoder().decode(bytes.slice(3));
    },
  };
}

test('CSV exports the stable first-seen union of columns from mixed dashboard rows', async t => {
  const output = downloads(t);
  const rows = [
    { metric: 'GitHub', Stars: 12, period: '2026' },
    { metric: 'Social', platform: 'WeChat', followers: 34, views: 56, period: '2026' },
    { metric: 'Articles', platform: 'Blog', articles: 2, reads: 78 },
  ];
  const before = structuredClone(rows);
  downloadCSV(rows, 'dashboard');
  assert.equal(await output.content(), [
    'metric,Stars,period,platform,followers,views,articles,reads',
    'GitHub,12,2026,,,,,',
    'Social,,2026,WeChat,34,56,,',
    'Articles,,,Blog,,,2,78',
  ].join('\n'));
  assert.deepEqual(rows, before);
  assert.equal(output.link.download, 'dashboard.csv');
  assert.equal(output.link.href, 'blob:test-csv');
  assert.equal(output.link.clicks, 1);
  assert.deepEqual(output.revoked, ['blob:test-csv']);
});

test('CSV quotes commas, double quotes, LF, CR and CRLF in values and headers', async t => {
  const output = downloads(t);
  downloadCSV([{
    'a,b': 'x,y', 'say"hi': 'a"b', 'line\nfeed': 'a\nb',
    'carriage\rreturn': 'a\rb', crlf: 'a\r\nb',
  }], 'escaped');
  assert.equal(await output.content(),
    '"a,b","say""hi","line\nfeed","carriage\rreturn",crlf\n"x,y","a""b","a\nb","a\rb","a\r\nb"');
});

test('CSV preserves single-schema order, zero, false and blank nullish cells', async t => {
  const output = downloads(t);
  downloadCSV([{ name: 'first', count: 0, active: false, missing: null }, { active: true, count: 5, name: 'second', missing: undefined }], 'single');
  assert.equal(await output.content(), 'name,count,active,missing\nfirst,0,false,\nsecond,5,true,');
});

test('CSV includes fields even when the first row has no keys', async t => {
  const output = downloads(t);
  downloadCSV([{}, { followers: 9 }], 'late-columns');
  assert.equal(await output.content(), 'followers\n\n9');
});

test('CSV does not create a download for empty input', t => {
  const output = downloads(t);
  downloadCSV([], 'empty');
  assert.deepEqual(output.blobs, []);
  assert.deepEqual(output.revoked, []);
  assert.equal(output.link.clicks, 0);
});
