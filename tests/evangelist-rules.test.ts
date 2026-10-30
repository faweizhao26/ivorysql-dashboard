import assert from 'node:assert/strict';
import test from 'node:test';

async function rules() { return import('../src/lib/evangelist-rules'); }
const date = '2026-10-29';

test('approved rules resolve renamed history without changing approved scores', async () => {
  const { mapLegacyContribution } = await rules();
  assert.deepEqual(mapLegacyContribution({ category: '其他', type: '宣传活动(5)', points: 15 }), { category: '宣传', type: '宣传 IvorySQL 社区活动', points: 15 });
  assert.deepEqual(mapLegacyContribution({ category: '内容创作', type: '自己渠道首发 IvorySQL 文章（15 分）', points: 15 }), { category: '内容创作', type: '本人渠道发布 IvorySQL 技术文章', points: 15 });
  assert.deepEqual(mapLegacyContribution({ category: '内容创作', type: '公众号转载(10)', points: 10 }), { category: '内容创作', type: '内容被公众号转载（历史项目）', points: 10 });
  assert.deepEqual(mapLegacyContribution({ category: '自定义', type: '尚未匹配', points: 35 }), { category: '自定义', type: '尚未匹配', points: 35 });
});

test('new selections suggest the approved article, answer, course and case points', async () => {
  const { getContributionBudget } = await rules();
  for (const [type, expected] of [['本人渠道发布 IvorySQL 技术文章', 30], ['原创技术答疑', 10], ['录制 IvorySQL 视频课程', 100], ['贡献迁移案例 / 用户故事', 50]] as const) {
    assert.equal(getContributionBudget([], { type, date, title: 'A' }).suggestedPoints, expected);
  }
});

test('promotion uses both per-type and combined yearly caps including legacy types', async () => {
  const { getContributionBudget } = await rules();
  const existing = [
    { id: 1, type: '宣传活动(5)', category: '其他', points: 30, date },
    { id: 2, type: '转载官方动态(10/篇·上限30)', category: '其他', points: 29, date },
    { id: 3, type: '转发 IvorySQL 社区官方动态', category: '宣传', points: 21, date: '2025-01-01' },
  ];
  const budget = getContributionBudget(existing, { type: '在知乎回答中推荐 IvorySQL', date });
  assert.equal(budget.availablePoints, 1);
  assert.equal(budget.suggestedPoints, 1);
  assert.ok(budget.limits.some(limit => limit.scope === 'promotion' && limit.currentPoints === 59 && limit.limit === 60));
  assert.equal(getContributionBudget(existing, { type: '宣传 IvorySQL 社区活动', date }).availablePoints, 0);
  assert.equal(getContributionBudget(existing, { type: '在知乎回答中推荐 IvorySQL', date: '2027-01-01' }).availablePoints, 5);
});

test('article group awards 30 then 15 irrespective of channel order, but no repeated path', async () => {
  const { getContributionBudget } = await rules();
  const official = { id: 1, type: '授权官方渠道发布 IvorySQL 技术文章', points: 30, date, title: 'Oracle 兼容实践', article_key: 'shared-work' };
  assert.equal(getContributionBudget([official], { type: '本人渠道发布 IvorySQL 技术文章', date, title: '另一标题', article_key: 'shared-work' }).suggestedPoints, 15);
  assert.equal(getContributionBudget([official], { type: '授权官方渠道发布 IvorySQL 技术文章', date, article_key: 'shared-work' }).availablePoints, 0);
  assert.equal(getContributionBudget([official], { type: '本人渠道发布 IvorySQL 技术文章', date, title: '独立新文章' }).suggestedPoints, 30);
  const personal = { ...official, type: '本人渠道发布 IvorySQL 技术文章' };
  assert.equal(getContributionBudget([personal], { type: '授权官方渠道发布 IvorySQL 技术文章', date, article_key: 'shared-work' }).suggestedPoints, 15);
});

test('answer cap and one-time HOW gift cannot be bypassed with edited rows or other years', async () => {
  const { getContributionBudget } = await rules();
  assert.equal(getContributionBudget([{ id: 1, type: '原创技术答疑', points: 95, date }], { type: '原创技术答疑', date }).suggestedPoints, 5);
  assert.equal(getContributionBudget([{ id: 1, type: 'HOW 2026 演讲(30)', points: 30, date: '2025-01-01' }], { type: 'HOW 2026 演讲特别赠分', date }).availablePoints, 0);
  assert.equal(getContributionBudget([{ id: 1, type: '原创技术答疑', points: 100, date }], { id: 1, type: '原创技术答疑', date }).suggestedPoints, 10);
});

test('server preparation protects unchanged historical points but rejects forged legacy exemptions', async () => {
  const { prepareEvangelistContribution } = await rules();
  const old = { id: 1, participant_id: 7, category: '宣传', type: '宣传 IvorySQL 社区活动', points: 75, date, rules_version: 'legacy' };
  const saved = prepareEvangelistContribution({ ...old, notes: '补充历史备注' }, [old], old);
  assert.equal(saved.points, 75);
  assert.equal(saved.rules_version, 'legacy');
  assert.throws(() => prepareEvangelistContribution({ participant_id: 7, category: '宣传', type: '宣传 IvorySQL 社区活动', points: 75, date, rules_version: 'legacy' }, []), /积分/);
  assert.throws(() => prepareEvangelistContribution({ ...old, points: 80 }, [old], old), /积分/);
});

test('new rows require valid dates, categories, integer scores and custom contribution notes', async () => {
  const { prepareEvangelistContribution } = await rules();
  const good = { participant_id: 7, category: '内容创作', type: '原创技术答疑', points: 10, date, title: '排查安装错误' };
  assert.equal(prepareEvangelistContribution(good, []).rules_version, '2026-10-29');
  for (const patch of [{ date: '' }, { date: '2026-02-30' }, { points: -1 }, { points: 1.2 }, { category: '宣传' }, { type: '未知类型' }]) {
    assert.throws(() => prepareEvangelistContribution({ ...good, ...patch }, []), RangeError);
  }
  assert.throws(() => prepareEvangelistContribution({ participant_id: 7, category: '其他', type: '其他贡献', points: 20, date }, []), /备注/);
  assert.throws(() => prepareEvangelistContribution({ ...good, type: '内容被公众号转载（历史项目）' }, []), /历史/);
});

test('legacy rows keep approved metadata and cannot use another participant history for exemption', async () => {
  const { prepareEvangelistContribution } = await rules();
  const old = { id: 2, participant_id: 7, category: '内容创作', type: '授权官方渠道发布 IvorySQL 技术视频', points: 15, date: null, rules_version: 'legacy' };
  const result = prepareEvangelistContribution({ ...old, title: '历史视频' }, [old], old);
  assert.equal(result.points, 15);
  assert.equal(result.date, null);
  assert.throws(() => prepareEvangelistContribution({ ...old, participant_id: 8 }, [old], old), RangeError);
});

test('HOW is a single award even when an older award was only partial', async () => {
  const { getContributionBudget } = await rules();
  assert.equal(getContributionBudget([{ id: 1, type: 'HOW 2026 演讲(30)', points: 15, date }], { type: 'HOW 2026 演讲特别赠分', date }).availablePoints, 0);
});

test('one article cannot be scored as both PostgreSQL and IvorySQL content', async () => {
  const { getContributionBudget } = await rules();
  const prior = { id: 1, type: '官方首发深度文章—纯PG(15)', title: '同一篇技术文章', points: 15, date };
  assert.equal(getContributionBudget([prior], { type: '授权官方渠道发布 IvorySQL 技术文章', title: prior.title, date }).availablePoints, 0);
});

test('an answer cannot reuse the exact same resource already awarded as an Issue', async () => {
  const { prepareEvangelistContribution } = await rules();
  const url = 'https://github.com/IvorySQL/IvorySQL/issues/123';
  assert.throws(() => prepareEvangelistContribution({ participant_id: 7, category: '内容创作', type: '原创技术答疑', points: 10, date, url }, [{ id: 1, type: '提交Issue/改进建议(5)', points: 5, date, url }]), /重复/);
});
