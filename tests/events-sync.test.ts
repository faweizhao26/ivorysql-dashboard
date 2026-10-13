import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalEventUrl, parseOfficialEventList, parseOfficialEventDetail, syncOfficialEvents } from '../src/lib/ivorysql-events-sync';
const list = readFileSync(new URL('./fixtures/ivorysql-events-list.html', import.meta.url), 'utf8');
const detail = readFileSync(new URL('./fixtures/ivorysql-event-detail.html', import.meta.url), 'utf8');

test('official list recognizes new paths, dates, and safe pagination', () => {
  const parsed = parseOfficialEventList(list);
  assert.equal(parsed.events[0].event_date, '2026-04-27');
  assert.equal(parsed.events[0].event_type, 'conference');
  assert.equal(parsed.nextPage, 'https://ivorysql.org/zh/community/events?page=2');
  assert.equal(canonicalEventUrl('https://www.ivorysql.org/zh-cn/events/event-202604/'), parsed.events[0].source_url);
  assert.throws(() => parseOfficialEventList('<main>404</main>'), /No official events/);
});
test('detail extracts links, images, notes and rejects unsafe schemes', () => {
  const materials = parseOfficialEventDetail(detail, 'https://ivorysql.org/zh/community/events/event-202604');
  assert.equal(materials.filter(m => m.material_type === 'poster').length, 1);
  assert.equal(materials.filter(m => m.material_type === 'photo').length, 1);
  assert.equal(materials.filter(m => m.material_type === 'video').length, 1);
  assert.match(materials.find(m => m.material_type === 'ppt')!.access_note!, /HOW2026/);
  assert.equal(materials.some(m => m.url?.startsWith('javascript:')), false);
  assert.throws(() => parseOfficialEventDetail('<div>Loading...</div>', 'https://ivorysql.org/zh/community/events/event-202604'), /No official event body/);
});
test('sync parses all pages before persisting and reruns use stable sources', async () => {
  const urls: string[] = [];
  const sources = new Set<string>();
  const options = { fetchPage: async (url: string) => { urls.push(url); return url.includes('event-202604') ? detail : list.replace(/<a rel="next"[\s\S]*?<\/a>/, ''); }, persistEvent: async (event: { source_url: string }) => { const added = !sources.has(event.source_url); sources.add(event.source_url); return added ? 1 : 0; } };
  assert.equal((await syncOfficialEvents(options)).recordsWritten, 1);
  assert.equal((await syncOfficialEvents(options)).recordsWritten, 0);
  assert.equal(sources.size, 1);
  assert.equal(urls.length, 4);
});
