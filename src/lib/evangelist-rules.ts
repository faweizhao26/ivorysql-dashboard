import { getBeijingDate } from './date';
import { isArticleDate } from './content-values.mjs';

export const EVANGELIST_RULES_VERSION = '2026-10-29';
export interface EvangelistRule {
  category: string;
  name: string;
  points: number | null;
  description: string;
  aliases: string[];
  annualLimit?: number;
  once?: boolean;
  articlePath?: 'official' | 'personal' | 'postgres';
}

export const EVANGELIST_RULES: EvangelistRule[] = [
  { category: '内容创作', name: '授权官方渠道发布 IvorySQL 技术文章', points: 30, articlePath: 'official', aliases: ['官方首发深度文章—IvorySQL(30)', '首发文章-IvorySQL(30)'], description: 'IvorySQL 原创技术文章，经官方审核并实际发布；同一篇与个人渠道发布合计最高 45 分。' },
  { category: '内容创作', name: '授权官方渠道发布 PostgreSQL 技术文章', points: 15, articlePath: 'postgres', aliases: ['官方首发深度文章—纯PG(15)'], description: 'PostgreSQL 原创技术文章，经官方审核并在官方渠道实际发布；与 IvorySQL 文章类型择一认定。' },
  { category: '内容创作', name: '本人渠道发布 IvorySQL 技术文章', points: 30, articlePath: 'personal', aliases: ['自己渠道首发 IvorySQL 文章（15 分）', '自己渠道发布 IvorySQL 文章（15 分）'], description: '本人至少 3 个不同平台发布同一篇原创文章，并通过官方质量审核；同篇官方与个人渠道合计最高 45 分。' },
  { category: '内容创作', name: '授权官方渠道发布 IvorySQL 技术视频', points: 20, aliases: ['官方发布技术视频(20)'], description: '本人录制且大于 3 分钟，经官方认可并实际发布；不接受 AI 生成视频或重复申报演讲回放。' },
  { category: '内容创作', name: '录制 IvorySQL 视频课程', points: 100, aliases: ['视频课程—完整≥5期(100+)', '视频课程(100+)'], description: '本人录制、体系完整，覆盖介绍到实践，不少于 5 期；100 分/套，单集不重复计分。' },
  { category: '内容创作', name: '原创技术答疑', points: 10, annualLimit: 100, aliases: [], description: '公开平台的原创 IvorySQL 技术解答，经官方认可；10 分/条、年度最高 100 分，不占宣传额度；同一回答不再加推荐分。' },
  { category: '活动参与', name: '参与 IvorySQL 直播活动分享', points: 40, aliases: ['IvorySQL 直播演讲(40)', '直播演讲(40)'], description: '在 IvorySQL 组织的直播中进行演讲或圆桌分享；同一场分享只按一种分享类型计分。' },
  { category: '活动参与', name: '在 IvorySQL 主办线下活动演讲 / Workshop', points: 60, aliases: ['主办线下演讲/Workshop(60)'], description: '在 IvorySQL 主办的线下活动演讲或带领 Workshop，PostgreSQL 或 IvorySQL 主题均可。' },
  { category: '活动参与', name: '在高校活动分享 IvorySQL 主题', points: 40, aliases: ['高校活动分享(40)'], description: '在非 IvorySQL 主办的高校活动分享 IvorySQL 主题；不与同场外部活动分享重复计分。' },
  { category: '活动参与', name: '在外部活动分享 IvorySQL 主题', points: 30, aliases: ['外部活动分享(30)'], description: '在非 IvorySQL 组织的线上或线下活动分享 IvorySQL 主题。' },
  { category: '活动参与', name: '参与组织线下 IvorySQL 技术活动', points: 30, aliases: ['组织线下Meetup(30)'], description: 'IvorySQL 主办；本人至少承担 3 项组织工作并说明；组织与上台分享属于不同工作，可分别申请。' },
  { category: '活动参与', name: '策划和组织 IvorySQL 直播活动', points: 40, aliases: ['策划和组织直播活动(40)'], description: '承担 IvorySQL 直播的主题策划、讲师邀请等组织工作；系列直播每场单独计算。' },
  { category: '活动参与', name: '同步转播 IvorySQL 活动', points: 20, aliases: [], description: '提前取得官方授权，在本人自媒体渠道同步转播并提供记录。' },
  { category: '活动参与', name: 'HOW 2026 演讲特别赠分', points: 30, once: true, aliases: ['HOW 2026 演讲(30)'], description: 'HOW 2026 演讲者每人一次 30 分；不与同场演讲积分叠加。' },
  { category: '社区贡献', name: '提交非 Bug 类 Issue / 改进建议', points: 5, aliases: ['提交Issue/改进建议(5)'], description: '在 IvorySQL GitHub 仓库提交非 Bug 类 Issue 或建议，且被官方采纳。' },
  { category: '社区贡献', name: '提交 Bug', points: 15, aliases: ['Bug提交(15)'], description: '提供环境、复现步骤并被确认；不再另计普通 Issue 分。报告 Bug 与后续修复 PR 可分别申请。' },
  { category: '社区贡献', name: '贡献代码 / 文档 PR', points: 25, aliases: ['贡献代码/文档PR(25)'], description: 'IvorySQL 仓库 PR 已合并；含文档贡献，仅修改错别字类不计入。' },
  { category: '社区贡献', name: '贡献迁移案例 / 用户故事', points: 50, aliases: ['贡献迁移案例/用户故事(40)'], description: '真实迁移至 IvorySQL 的案例或企业使用实践文章，经官方审核认可。' },
  { category: '宣传', name: '宣传 IvorySQL 社区活动', points: 5, annualLimit: 30, aliases: ['宣传社区活动(5/次·上限30)', '宣传活动(5)'], description: '本人朋友圈、社群等渠道宣传活动；单项年度最高 30 分，宣传类合计年度最高 60 分。' },
  { category: '宣传', name: '转载 IvorySQL 社区官方动态', points: 10, annualLimit: 30, aliases: ['转载官方动态(10/篇·上限30)', '转载公告(10)'], description: '本人自媒体账号转载官方动态；单项年度最高 30 分，宣传类合计年度最高 60 分。' },
  { category: '宣传', name: '转发 IvorySQL 社区官方动态', points: 3, annualLimit: 21, aliases: ['转发官方动态(3/次·上限21)'], description: '朋友圈或社群转发官方动态，活动宣传除外；单项年度最高 21 分，宣传类合计年度最高 60 分。' },
  { category: '宣传', name: '在知乎回答中推荐 IvorySQL', points: 5, annualLimit: 30, aliases: [], description: '回答相关问题并说明适用场景；仅产品名称、链接或无关广告不计分；单项年度最高 30 分，宣传合计最高 60 分。' },
  { category: '其他', name: '其他贡献', points: null, aliases: ['其他'], description: '填写具体贡献及给分理由，由官方审核确认分值。' },
];
export const EVANGELIST_CATEGORIES = ['内容创作', '活动参与', '社区贡献', '宣传', '其他'];
export const evangelistContributionTypes: Record<string, string[]> = Object.fromEntries(EVANGELIST_CATEGORIES.map(category => [category, EVANGELIST_RULES.filter(rule => rule.category === category).map(rule => rule.name)]));
export const evangelistContributionLimits: Record<string, number> = Object.fromEntries(EVANGELIST_RULES.filter(rule => rule.annualLimit).flatMap(rule => [rule.name, ...rule.aliases].map(name => [name, rule.annualLimit!])));
export const LEGACY_REPRINT = '内容被公众号转载（历史项目）';
export function getEvangelistRule(type?: string) {
  return EVANGELIST_RULES.find(rule => rule.name === type || rule.aliases.includes(type || ''));
}
export function mapLegacyContribution<T extends { category?: string; type?: string }>(record: T): T {
  const rule = getEvangelistRule(record.type);
  if (rule) return { ...record, category: rule.category, type: rule.name };
  if (['内容被公众号转载(10)', '公众号转载(10)', LEGACY_REPRINT].includes(record.type || '')) return { ...record, category: '内容创作', type: LEGACY_REPRINT };
  return { ...record };
}
export interface EvangelistContributionDraft {
  id?: number;
  participant_id?: number;
  category?: string;
  type?: string;
  title?: string | null;
  url?: string | null;
  points?: number;
  date?: string | null;
  notes?: string | null;
  rules_version?: string;
  article_key?: string | null;
  created_at?: string | Date;
}
export interface ContributionLimit {
  scope: 'type' | 'promotion' | 'article' | 'once';
  label: string;
  currentPoints: number;
  limit: number;
}
export function getArticleKey(record: EvangelistContributionDraft): string {
  return (record.article_key || record.title || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
export function getContributionBudget(history: EvangelistContributionDraft[], draft: EvangelistContributionDraft) {
  const rule = getEvangelistRule(draft.type);
  const year = (draft.date || getBeijingDate()).slice(0, 4);
  const other = history.filter(row => row.id === undefined || row.id !== draft.id);
  const inYear = other.filter(row => {
    const created = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
    return (row.date || created || year).startsWith(year);
  });
  const points = (rows: EvangelistContributionDraft[]) => rows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
  const sameType = (row: EvangelistContributionDraft) => getEvangelistRule(row.type)?.name === rule?.name;
  const limits: ContributionLimit[] = [];
  let availablePoints = rule?.points ?? Infinity;
  if (rule?.annualLimit) limits.push({ scope: 'type', label: `${year} 年该类型`, currentPoints: points(inYear.filter(sameType)), limit: rule.annualLimit });
  if (rule?.category === '宣传') limits.push({ scope: 'promotion', label: `${year} 年宣传类合计`, currentPoints: points(inYear.filter(row => getEvangelistRule(row.type)?.category === '宣传')), limit: 60 });
  if (rule?.once) {
    limits.push({ scope: 'once', label: '每人一次', currentPoints: points(other.filter(sameType)), limit: 30 });
    if (other.some(sameType)) availablePoints = 0;
  }
  if (rule?.articlePath && getArticleKey(draft)) {
    const sameArticle = other.filter(row => getEvangelistRule(row.type)?.articlePath && getArticleKey(row) === getArticleKey(draft));
    limits.push({ scope: 'article', label: '同一篇文章', currentPoints: points(sameArticle), limit: rule.articlePath === 'postgres' ? 15 : 45 });
    if (sameArticle.some(sameType) || (sameArticle.length && (rule.articlePath === 'postgres' || sameArticle.some(row => getEvangelistRule(row.type)?.articlePath === 'postgres')))) availablePoints = 0;
  }
  for (const limit of limits) availablePoints = Math.min(availablePoints, Math.max(0, limit.limit - limit.currentPoints));
  return { rule, limits, availablePoints, suggestedPoints: Number.isFinite(availablePoints) ? availablePoints : 0 };
}

export function isHistoricalScorePreserved(body: EvangelistContributionDraft, previous?: EvangelistContributionDraft): boolean {
  if (!previous || previous.rules_version === EVANGELIST_RULES_VERSION || previous.participant_id !== body.participant_id) return false;
  const mapped = mapLegacyContribution(body);
  const oldMapped = mapLegacyContribution(previous);
  return mapped.type === oldMapped.type && mapped.category === oldMapped.category
    && body.points === previous.points && (body.date || null) === (previous.date || null)
    && (body.article_key || null) === (previous.article_key || null);
}
export function prepareEvangelistContribution(body: EvangelistContributionDraft, history: EvangelistContributionDraft[], previous?: EvangelistContributionDraft) {
  if (!Number.isSafeInteger(body.participant_id) || Number(body.participant_id) <= 0) throw new RangeError('请选择有效成员');
  if (previous && previous.participant_id !== body.participant_id) throw new RangeError('不能更换已有贡献的成员');
  const mapped = mapLegacyContribution(body);
  const rule = getEvangelistRule(mapped.type);
  const historical = isHistoricalScorePreserved(body, previous);
  if (!historical && mapped.type === LEGACY_REPRINT) throw new RangeError('历史项目仅保留已有记录，不能新增');
  if (!historical && (!rule || body.category !== rule.category)) throw new RangeError('请选择对应的贡献类别和类型');
  const budget = getContributionBudget(history, { ...mapped, id: previous?.id });
  const score = body.points ?? budget.suggestedPoints;
  if (!Number.isSafeInteger(score) || score < 0) throw new RangeError('积分必须是非负整数');
  if (!historical && !isArticleDate(body.date || '')) throw new RangeError('请填写有效的贡献日期');
  if (!historical && rule?.articlePath && !getArticleKey(body)) throw new RangeError('请填写文章标题或选择归属文章');
  if (!historical && rule?.category === '其他' && !body.notes?.trim()) throw new RangeError('其他贡献需填写备注及给分理由');
  if (!historical && score > budget.availablePoints) throw new RangeError(`本项本次最多可计 ${budget.availablePoints} 分，请调整积分；标准分值、年度上限或同篇上限已生效`);
  if (!historical && ['原创技术答疑', '在知乎回答中推荐 IvorySQL'].includes(rule?.name || '') && body.url) {
    const url = body.url.trim().replace(/\/$/, '');
    if (history.some(row => row.id !== previous?.id && row.url?.trim().replace(/\/$/, '') === url)) throw new RangeError('同一条回答或成果不能重复计分或同时申领答疑与推荐积分');
  }
  return {
    ...mapped, points: score, date: body.date || null,
    rules_version: historical ? (previous!.rules_version || 'legacy') : EVANGELIST_RULES_VERSION,
    article_key: historical ? (previous!.article_key || null) : rule?.articlePath ? getArticleKey(body) : null,
  };
}
