import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateMonthlyContributorActivity } from '../src/lib/contributor-activity';
import { buildOperationsReport, reportText, type ReportSources } from '../src/lib/operations-report';
import { reportPeriod } from '../src/lib/report-period';
import { reportWord } from '../src/lib/report-word';

const contribution = (participant_id: number, date: string | null, title: string, points: number) =>
  ({ participant_id, date, title, points, category: '宣传', type: '推广', url: 'https://example.org/work' });

const sources: ReportSources = {
  github: { date: '2026-11-24', months: aggregateMonthlyContributorActivity([
    { number:1, type:'issue', status:'open', author:'Alice', created_at:'2026-10-05' },
    { number:2, type:'pr', status:'merged', author:'Alice', created_at:'2026-09-28', merged_at:'2026-11-04' },
    { number:3, type:'pr', status:'open', author:'Bob', created_at:'2026-11-06' },
  ], 2026) },
  articles: [
    { platform:'wechat', article_title:'入门教程', article_url:'https://example.org/article', views:10, date:'2026-10-11', content_category:'技术教程' },
    { platform:'zhihu', article_title:'待读数', article_url:null, views:null, date:'2026-11-10' },
    { platform:'zhihu', article_title:'旧文章', article_url:null, views:3000, date:'2026-07-10' },
  ],
  counters: [{ label:'Stars', start:null, end:{date:'2026-11-23',value:100} }],
  activities: [
    { id:1, event_name:'旧活动', event_date:'2026-11-10' },
    { id:2, event_name:'已完成演讲', event_date:'2026-09-15', event_type:'webinar', participants:32, registrations:40, online_viewers:300, collected_data:{workspace:{status:'completed',actual_date:'2026-10-12',leads:3}} },
    { id:3, event_name:'明年计划', event_date:'2027-01-05', collected_data:{workspace:{status:'confirmed'}} },
  ],
  materials: [{ event_id:2,title:'活动海报',url:'https://example.org/poster' }],
  members: [{id:1,name:'示例成员甲'},{id:2,name:'示例成员乙'},{id:3,name:'示例成员丙'}],
  contributions: [
    contribution(1,'2026-09-29','早期行为',70), contribution(1,'2026-10-04','宣讲',30),
    contribution(2,'2026-11-12','未达标也应列出',10), contribution(3,null,'未定日期',100),
  ],
};

const report = buildOperationsReport(reportPeriod('quarter','2026-Q4','2026-11-24'), sources, '2026-11-24T04:00:00Z');

test('report keeps actuals, plans and missing data separate', () => {
  const text = reportText(report);
  assert.match(text,/1 条截至生成日累计阅读 10 次/);
  assert.match(text,/补齐 1 条缺失阅读量/);
  assert.match(text,/Issue 创建 1 条、PR 提交 1 条、PR 合并 1 条/);
  assert.match(text,/有效贡献者 1 人/);
  assert.match(text,/缺少可比较的期初、期末快照/);
  assert.match(text,/2026-10-12 · 已完成演讲/);
  assert.match(text,/历史记录（未标记完成，不计入已完成数）：旧活动/);
  assert.match(text,/2027-01-05 · 明年计划/);
});

test('reports all in-period advocacy and separates missing and first qualification dates', () => {
  const text = reportText(report);
  assert.match(text,/2 人完成了 2 项有日期的布道行为，1 人本期首次达到 100 分/);
  assert.match(text,/首次达到 100 分：示例成员甲（2026-10-04）/);
  assert.match(text,/未达标也应列出/);
  assert.match(text,/达标日期待确认（不计入本期人数）：示例成员丙/);
  assert.doesNotMatch(text,/早期行为|未定日期/);
});

test('Word export is a native docx package', async () => {
  const blob = await reportWord(report);
  const file = Buffer.from(await blob.arrayBuffer());
  assert.equal(file.subarray(0,4).toString('hex'),'504b0304');
  assert.ok(file.includes(Buffer.from('word/document.xml')));
  assert.ok(file.includes(Buffer.from('word/_rels/document.xml.rels')));
});

test('analysis uses equal elapsed days and never compares lifetime article reads', () => {
  const text = reportText(report);
  assert.match(text,/上期 2026-07-01 至 2026-08-24/);
  assert.match(text,/渠道发布记录（条） \| 2 \| 1 \| \+1 \| \+100%/);
  assert.match(text,/阅读量不作环比/);
  assert.match(text,/内容分类：技术教程 1、未分类 1|内容分类：未分类 1、技术教程 1/);
  assert.match(text,/现状总结/);
  assert.match(text,/补齐 1 条缺失阅读量/);
  assert.doesNotMatch(text,/旧文章|3,000/);
});

test('channel table excludes missing reads from medians and preserves real zero readings', () => {
  const rich = buildOperationsReport(report.period, { ...sources, articles:[
    ...sources.articles,
    {platform:'wechat',article_title:'无阅读',article_url:null,views:0,date:'2026-11-11'},
    {platform:'wechat',article_title:'异常高阅读示例',article_url:null,views:2000,date:'2026-11-12'},
  ] }, report.generatedAt);
  const table = rich.sections.find(s=>s.title==='内容表现分析')?.table;
  assert.deepEqual(table?.rows, [['公众号','3','3 / 3','2,010','10'],['知乎','1','0 / 1','—','—']]);
  const missing = buildOperationsReport(report.period, {...sources,articles:sources.articles.slice(0,2),contributions:[]}, report.generatedAt);
  assert.deepEqual(missing.sections[0].table?.rows[0], ['渠道发布记录（条）','2','—','—','—']);
});

test('report lists every publication and marks advocacy only from explicit source or a matching official contribution link', () => {
  const rich = buildOperationsReport(report.period, {...sources,
    articles:[
      ...sources.articles,
      {platform:'official',date:'2026-10-20',article_title:'演讲原文',article_url:'https://example.org/talk',views:0,content_category:'HOW 2026 演讲整理',content_source:'布道者投稿'},
      {platform:'csdn',date:'2026-11-18',article_title:'入门教程',article_url:'https://example.org/other',views:1,content_category:'技术教程',content_source:'社区'},
    ],
    contributions:[...sources.contributions,{
      ...contribution(1,'2026-10-11','原始标题',30),
      type:'授权官方渠道发布 IvorySQL 技术文章',url:'https://example.org/article?utm_source=wechat#content',
    }],
  }, report.generatedAt);
  const details=rich.sections.find(s=>s.title==='内容运营')?.appendix;
  assert.equal(details?.length,4);
  assert.deepEqual(details?.find(r=>r.text.includes('演讲原文'))?.tags,['HOW 2026 演讲整理','布道者投稿']);
  assert.match(details?.find(r=>r.text.includes('演讲原文'))?.text ?? '', /累计阅读 0/);
  assert.match(details?.find(r=>r.links?.[0]?.url==='https://example.org/article')?.text ?? '',/布道者投稿：示例成员甲/);
  assert.ok(!details?.find(r=>r.links?.[0]?.url==='https://example.org/other')?.tags?.includes('布道者投稿'));
  assert.match(details?.find(r=>r.text.includes('待读数'))?.text ?? '',/阅读量待补录/);
});

test('activity outcomes, dated GitHub actions and both first-contribution cohorts stay distinct', () => {
  const events = report.sections.find(s=>s.title==='社区活动')?.appendix ?? [];
  assert.match(events[0].text,/线上直播.*报名 40 人.*参与 32 人.*线上观看 300.*留资 3 条/);
  assert.equal(events[0].links?.[0]?.url,'https://example.org/poster');
  assert.match(events[1].text,/完成状态待核实/);
  const github = report.sections.find(s=>s.title==='GitHub 社区')?.appendix ?? [];
  assert.equal(github.length,3);
  assert.equal(github.filter(row=>row.tags?.includes('合并 PR')).length,1);
  assert.ok(!github.some(row=>row.text.includes('2026-09-28')));
  assert.ok(report.sections[0].table?.rows.some(row=>row[0]==='往年贡献过、本年首次（人）'));
});

test('January compares with December using the first valid date in each year, not the first date across both', () => {
  const history = [
    { number: 1, type: 'issue', status: 'open', author: 'veteran', created_at: '2025-06-01' },
    { number: 2, type: 'issue', status: 'open', author: 'returns', created_at: '2026-12-01' },
    { number: 3, type: 'pr', status: 'merged', author: 'returns', created_at: '2026-12-20', merged_at: '2027-01-07' },
    { number: 4, type: 'issue', status: 'open', author: 'returns', created_at: '2027-01-09' },
    { number: 5, type: 'issue', status: 'open', author: 'veteran', created_at: '2027-01-04' },
    { number: 6, type: 'issue', status: 'open', author: 'new', created_at: '2027-01-10' },
  ] as const;
  const december = aggregateMonthlyContributorActivity([...history], 2026);
  const january = aggregateMonthlyContributorActivity([...history], 2027);
  const period = reportPeriod('month','2027-01','2027-02-02');
  const make = (months: typeof january) => buildOperationsReport(period, { ...sources, github: { date:'2027-01-31', months } }, report.generatedAt);
  const full = make([...december, ...january]);
  const rows = full.sections[0].table!.rows;
  const pair = (label: string) => rows.find(row => row[0] === label)?.slice(1,3);
  assert.deepEqual(pair('有效贡献者（人）'), ['3','1']);
  assert.deepEqual(pair('历史首次贡献者（人）'), ['1','1']);
  assert.deepEqual(pair('往年贡献过、本年首次（人）'), ['2','0']);
  assert.deepEqual(pair('提交 PR（条）'), ['0','1']);
  assert.deepEqual(pair('合并 PR（条）'), ['1','0']);
  assert.match(reportText(full), /往年贡献过、本年首次：returns（2027-01-07）、veteran（2027-01-04）/);
  assert.equal(full.sections.find(s => s.title.startsWith('期内趋势'))?.table?.rows[0].at(-1), '2');
  assert.equal(make(january).sections[0].table?.rows.find(row => row[0] === '有效贡献者（人）')?.[2], '—');
  assert.match(reportText(make(december)), /所选年份暂无/);
});
