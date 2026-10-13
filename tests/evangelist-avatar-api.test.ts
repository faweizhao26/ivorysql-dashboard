import assert from 'node:assert/strict';
import test from 'node:test';
import { POST, PUT } from '../src/app/api/evangelist/route';

test('rejects unreviewed avatars before any participant write', async () => {
  for (const [method, handler] of [['POST', POST], ['PUT', PUT]] as const) {
    const response = await handler(new Request('http://localhost/api/evangelist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, name: '头像验证', avatar_url: 'https://example.com/unknown.png' }),
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, '请选择头像库中的头像');
  }
});
