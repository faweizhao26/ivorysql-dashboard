import assert from 'node:assert/strict';
import test from 'node:test';
import { materialDraft, materialPayload } from '../src/lib/material-draft';

test('material editing keeps extraction notes and validates before a write', () => {
  const draft = { ...materialDraft(), title: '资料', url: 'https://pan.example.com/a', access_note: '提取码：1234' };
  assert.equal(materialPayload(7, draft).access_note, '提取码：1234');
  assert.throws(() => materialPayload(7, { ...draft, url: 'javascript:alert(1)' }), /https/);
  assert.equal(draft.url, 'https://pan.example.com/a');
  assert.equal(materialPayload(7, { ...draft, url: '' }).url, null);
});
