import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultWorkspace, validateWorkspace, eventMatches, publicEvent, eventProgress, promotionSummary } from '../src/lib/event-workspace';

test('new plans are private and an absent date does not mark historical activity complete', () => {
  assert.equal(defaultWorkspace().visibility, 'internal');
  assert.equal(defaultWorkspace().status, 'intent');
  const legacy = { event_date: '2025-01-01', collected_data: {} };
  assert.equal(publicEvent(legacy)?.collected_data.workspace.status, 'recorded');
  assert.equal(publicEvent({ ...legacy, collected_data: { workspace: defaultWorkspace() } }), null);
});
test('rejects invalid dates, negative metrics, unsafe links and duplicate task identifiers', () => {
  assert.throws(() => validateWorkspace({ ...defaultWorkspace(), month: '2026-13' }), /月份/);
  assert.throws(() => validateWorkspace({ ...defaultWorkspace(), target_participants: -1 }), /人数/);
  assert.throws(() => validateWorkspace({ ...defaultWorkspace(), promotions: [{ id: 'a', kind: 'preview', url: 'javascript:alert(1)' }] }), /链接/);
  assert.throws(() => validateWorkspace({ ...defaultWorkspace(), tasks: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] }), /重复/);
});
test('date filters include cross-month events and keep unassigned plans separate', () => {
  const event = { event_name: '分享', event_date: '2026-11-30', event_type: 'webinar', collected_data: { workspace: { ...defaultWorkspace(), end_date: '2026-12-02' } } };
  assert.equal(eventMatches(event, { month: '2026-12' }), true);
  assert.equal(eventMatches({ ...event, event_date: '', collected_data: { workspace: defaultWorkspace() } }, { month: '2026-12' }), false);
});
test('task progress and promotion readings count actual completed tasks and unique URLs', () => {
  const w = validateWorkspace({ ...defaultWorkspace(), tasks: [{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B' }], promotions: [{ id: 'a', kind: 'preview', url: 'https://example.com/a', views: 10 }, { id: 'b', kind: 'recap', url: 'https://example.com/a', views: 10 }, { id: 'c', kind: 'recap', url: 'https://example.com/b', views: null }] });
  assert.equal(eventProgress(w), 50);
  assert.deepEqual(promotionSummary([w]), { articles: 2, views: 10, missing: 1 });
});
