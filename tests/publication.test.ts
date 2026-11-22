import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePlan, parsePublication } from '../src/lib/publication';

test('计划可不定日期、不含实发信息，历史渠道不参与排期', () => {
  assert.deepEqual(parsePlan({ title:' 教程 ', channels:['wechat','official','wechat'], url:'example', views:100 }), {
    title:'教程', planned_date:null, channels:['wechat','official'],
  });
  assert.throws(()=>parsePlan({ title:'教程',channels:['juejin'] }),RangeError);
  assert.throws(()=>parsePlan({ title:'教程',channels:['official'],planned_date:'2026-02-30' }),RangeError);
});
test('独立登记与关联排期均使用实际日期、渠道和标题，不导入阅读量', () => {
  const input={ title:'实际标题',date:'2026-11-20',platform:'official',url:'https://example.org/articles/1',views:99 };
  const result=parsePublication(input,'2026-11-22');
  assert.deepEqual(result,{title:input.title,date:input.date,platform:'official',url:input.url,planId:null});
  assert.deepEqual(parsePublication({...input,planId:'3'},'2026-11-22'),{...result,planId:3});
  assert.throws(()=>parsePublication({...input,date:'2026-12-01'},'2026-11-22'),RangeError);
});
