import test from 'node:test';
import assert from 'node:assert/strict';
import { githubTimeline } from '../src/lib/github-timeline';
import type { ContributorActivityItem } from '../src/lib/contributor-activity';

const pr: ContributorActivityItem = {number: 81, type:'pr', status:'merged', author:'alice', created_at:'2026-10-30', merged_at:'2026-11-20', title:'Fix', url:'https://github.com/IvorySQL/IvorySQL/pull/81'};
const issue: ContributorActivityItem = {number:82,type:'issue',status:'closed',author:'bob',created_at:'2026-11-17'};
const legacy = {date:'2026-11-20',source:'github',event_type:'github_pr', title:'Old label', description:'',url:pr.url!};
test('the week includes creations and merges by action date, not by snapshot month or open state',()=>{
  const rows=githubTimeline([{contributions:[pr,issue,pr]}],[legacy],'2026-11-17','2026-11-23');
  assert.deepEqual(rows.map(r=>[r.date,r.source]),[['2026-11-20','PR 合并'],['2026-11-17','Issue 创建']]);
  assert.equal(rows[1].url,'https://github.com/IvorySQL/IvorySQL/issues/82');
  const month=githubTimeline([{contributions:[pr,issue]}],[],'2026-10-25','2026-11-23');
  assert.equal(month.at(-1)?.source,'PR 提交');
});
test('same-day PR opening and merging are distinct; older archive-only rows are retained once',()=>{
  const rows=githubTimeline([{contributions:[{...pr,created_at:legacy.date}]}],[legacy],'2026-11-20','2026-11-20');
  assert.equal(rows.length,2);
  assert.deepEqual(githubTimeline([], [legacy,legacy,{...legacy,event_type:'news'}],legacy.date,legacy.date),[legacy]);
  assert.deepEqual(githubTimeline([{contributions:[pr,issue]}],[legacy],'2026-11-21','2026-11-21'),[]);
});
