import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationCsv } from '../src/lib/publication-csv';

test('uses the template channel order, adds official last and leaves unused channels blank', () => {
  const csv=publicationCsv('actual','2026',[{date:'2026-11-21',title:'日报',channels:['csdn','official']}]);
  assert.ok(csv.startsWith('\uFEFF"IvorySQL 社区 2026 年内容实际发布情况"'));
  const [,header,row]=csv.split('\r\n');
  assert.equal(header,'"时间","发布内容","微信公众号","CSDN","OSC","思否","知乎","墨天轮","ITPUB","51CTO","今日头条","博客园","IFCLUB","掘金","官网"');
  assert.equal(row,'"2026-11-21","日报","","✅","","","","","","","","","","","✅"');
});
test('retains undated plans, protects text cells and emits valid empty exports', () => {
  const csv=publicationCsv('plan',null,[{date:null,title:'=日报,"一"\n二',channels:['wechat']}]);
  assert.ok(csv.includes(`"","'=日报,""一""\n二","✅"`));
  assert.equal(publicationCsv('plan','2026',[]).trimEnd().split('\r\n').length,2);
});
