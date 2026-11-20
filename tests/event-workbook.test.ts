import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildEventWorkbook } from '../src/lib/event-workbook';
import { defaultWorkspace } from '../src/lib/event-workspace';
test('exports both original sheets with merged headers, typed dates, approximate counts and blank unknown readings', async () => {
  const buffer = await buildEventWorkbook([{ id: 1, event_name: '=1+1', event_date: '2026-12-12', event_type: 'meetup', participants: 0, registrations: 0, online_viewers: 0, collected_data: { workspace: { ...defaultWorkspace(), month: '2026-12', coverage: '200+', role: '主办', promotions: [{ id: 'p', kind: 'preview', title: '', platform: 'wechat', url: 'https://example.com/a', views: null, updated_at: '' }] } } }]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  assert.deepEqual(book.worksheets.map(s => s.name), ['参与和组织', '活动计划']);
  const records = book.getWorksheet('参与和组织')!;
  assert.equal(records.getCell('A4').value, '=1+1');
  assert(records.getCell('B4').value instanceof Date);
  assert.equal(records.getCell('F4').value, '200+');
  assert.equal(records.getCell('H4').value, null);
  assert.equal(records.getCell('G2').value, '活动预告');
  assert.equal(book.getWorksheet('活动计划')!.getCell('B2').value, 12);
});
