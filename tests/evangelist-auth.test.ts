import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresAdminMutation } from '../src/proxy';

test('all evangelist writes require an admin while viewing remains available', () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal(requiresAdminMutation('/api/evangelist', method), true);
  }
  assert.equal(requiresAdminMutation('/api/evangelist', 'GET'), false);
});
