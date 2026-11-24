import { normalizeMonthlyContributorActivity, type MainRepoMonthlyActivity } from './contributor-activity';
import { EVENT_TYPES } from './events-ui';
import { contributorDetails, platformName, publicationDetails, reportLink as link } from './report-details';
import { COMMUNITY_EVANGELIST_POINTS, firstQualificationDate } from './evangelist-milestone';
import { isArticleDate } from './content-values.mjs';
import { promotionSummary, readWorkspace } from './event-workspace';
import { shiftDate } from './date';
import type { ReportPeriod, ReportRange } from './report-period';
import { analyzeOperations, median, reportNumber as number } from './operations-analysis';

export type ReportLine = { text: string; tags?: string[]; links?: { label: string; url: string }[] };
export type ReportTable = { columns: string[]; rows: string[][] };
export type ReportSection = { title: string; lines: ReportLine[]; table?: ReportTable; appendix?: ReportLine[] };
export type ReportDocument = { period: ReportPeriod; generatedAt: string; summary: string[]; sections: ReportSection[] };
type Counter = { date: string; value: number | null };
export type ReportSources = {
  articles: { platform: string; article_title: string; article_url: string | null; views: number | null; date: string; content_category?: string | null; content_source?: string | null }[];
  github: { date: string; months: MainRepoMonthlyActivity[] } | null;
  counters: { label: string; start: Counter | null; end: Counter | null }[];
  activities: { id: number; event_name: string; event_date: string; event_type?: string; location?: string; participants?: number; registrations?: number; online_viewers?: number; collected_data?: unknown }[];
  materials: { event_id: number; title: string; url: string }[];
  members: { id: number; name: string }[];
  contributions: { participant_id: number; category: string; type: string; title: string | null; date: string | null; points: number; url: string | null }[];
};

const line = (text: string): ReportLine => ({ text });
const inRange = (day: string | null | undefined, range: ReportRange) => Boolean(day && day >= range.start && day <= range.end && isArticleDate(day));
const segments = (keys: string[]) => [...Map.groupBy(keys, k => k)]
  .map(([label, rows]) => ({ label, count: rows.length })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));

export function buildOperationsReport(period: ReportPeriod, data: ReportSources, generatedAt: string): ReportDocument {
  const { start, end, plannedEnd, nextEnd } = period;
  const within = (day?: string | null) => inRange(day, period);
  const nextStart = shiftDate(plannedEnd, 1);
  const released = data.articles.filter(a => within(a.date));
  const classified = publicationDetails(data.articles, data.contributions, data.members);
  const articleDetails = classified.filter(a => within(a.date));
  const focusTags = ['技术文章','HOW 2026 演讲整理','布道者投稿'];
  const articleFocus = (range: ReportRange) => focusTags.map(label => ({
    label, count:classified.filter(a => inRange(a.date,range) && a.tags.includes(label)).length,
  }));
  const measured = released.filter(a => a.views !== null);
  const reads = measured.reduce((sum, row) => sum + (row.views ?? 0), 0);
  const channels = [...Map.groupBy(released, a => a.platform)].map(([platform, selected]) => {
    const readings = selected.flatMap(a => a.views === null ? [] : [a.views]);
    return { label: platformName(platform), articles: selected.length, measured: readings.length,
      reads: readings.reduce((sum, views) => sum + views, 0), median: median(readings) };
  });

  const coverage = '2026';
  const github = data.github;
  const covered = github && start.slice(0, 4) === coverage;
  const items = [...new Map(github?.months.flatMap(m => m.contributions).map(c => [c.type + ':' + c.number, c]) ?? []).values()];
  const issues = items.filter(c => c.type === 'issue' && within(c.created_at));
  const opened = items.filter(c => c.type === 'pr' && within(c.created_at));
  const merged = items.filter(c => c.type === 'pr' && c.status === 'merged' && within(c.merged_at));
  const contributors = new Set([...issues, ...merged].map(c => c.author));
  const months = covered ? normalizeMonthlyContributorActivity(github.months) : [];
  const firstSeen = new Map<string,string>();
  for (const item of items) {
    const day = item.type === 'issue' ? item.created_at : item.status === 'merged' ? item.merged_at : undefined;
    if (!day?.startsWith(coverage + '-')) continue;
    const earliest = firstSeen.get(item.author);
    if (!earliest || day < earliest) firstSeen.set(item.author, day);
  }
  const historical = new Set(months.flatMap(m => m.new_contributors));
  const returning = new Set(months.flatMap(m => m.year_first_contributors));
  const firstIn = (names: Set<string>, range: ReportRange) => [...names].filter(name => inRange(firstSeen.get(name), range)).sort();
  const newcomers = firstIn(historical, period);
  const firstThisYear = firstIn(returning, period);
  const githubLines = covered ? [
    line(`记录到 Issue 创建 ${issues.length} 条、PR 提交 ${opened.length} 条、PR 合并 ${merged.length} 条。`),
    line(`有效贡献者 ${contributors.size} 人，历史首次 ${newcomers.length} 人，往年贡献过、本年首次 ${firstThisYear.length} 人。创建 Issue 或合并 PR 计为有效贡献，两类首次不重复，同一人跨月去重。`),
    ...(newcomers.length ? [line(`历史首次：${newcomers.map(name => name + '（' + firstSeen.get(name) + '）').join('、')}。`)] : []),
    ...(firstThisYear.length ? [line(`往年贡献过、本年首次：${firstThisYear.map(name => name + '（' + firstSeen.get(name) + '）').join('、')}。`)] : []),
    line(`来源：${github.date} 的主仓库月度快照。${github.date < end ? '快照早于统计截止日，本期数据可能不全。' : ''}PR 提交数以快照收录的明细为准。`),
  ] : [line('所选年份暂无可用的主仓库月度贡献明细，未估算人数或活动量。')];
  const counterLine = ({ label, start: a, end: b }: ReportSources['counters'][number]) => {
    if (!b || b.value == null) return line(`${label}：无期末快照。`);
    if (!a || a.value == null || a.date >= b.date) return line(`${label}：${number(b.value)}（${b.date}），缺少可比较的期初、期末快照。`);
    const change = b.value - a.value;
    return line(`${label}：${number(a.value)} → ${number(b.value)}，净变化 ${change > 0 ? '+' : ''}${number(change)}（${a.date} 至 ${b.date}${a.date !== shiftDate(start, -1) || b.date !== end ? '，快照未覆盖完整周期' : ''}）。`);
  };

  const activities = data.activities.map(event => ({ ...event, detail: readWorkspace(event) }));
  const heldIn = (range: ReportRange) => activities.filter(e => e.detail.status === 'completed' && inRange(e.detail.actual_date || e.event_date, range));
  const completed = heldIn(period);
  const archive = activities.filter(e => e.detail.status === 'recorded' && within(e.event_date));
  const upcoming = activities.filter(e => {
    const date = e.event_date || (e.detail.month ? e.detail.month + '-01' : '');
    return ['intent', 'preparing', 'confirmed'].includes(e.detail.status) && date >= nextStart && date <= nextEnd;
  });
  const promotions = promotionSummary(completed.map(e => e.detail));
  const materials = Map.groupBy(data.materials, m => m.event_id);
  const held = completed.sort((a, b) => (a.detail.actual_date || a.event_date).localeCompare(b.detail.actual_date || b.event_date));
  const eventType = (e: typeof activities[number]) => EVENT_TYPES.find(t => t.value === e.event_type)?.label || '未分类';
  const eventDetails = (e: typeof activities[number], confirmed: boolean): ReportLine => {
    const w = e.detail;
    const outcomes = [w.coverage && '覆盖 ' + w.coverage + ' 人',
      e.registrations && '报名 ' + number(e.registrations) + ' 人',
      e.participants && '参与 ' + number(e.participants) + ' 人',
      e.online_viewers && '线上观看 ' + number(e.online_viewers),
      w.leads != null && '留资 ' + number(w.leads) + ' 条'].filter(Boolean);
    const tagged = eventType(e);
    return {
      tags:[tagged, confirmed ? '已完成' : '历史记录'],
      text:[confirmed ? w.actual_date || e.event_date : e.event_date, e.event_name, tagged,
        w.format, w.role, e.location, !confirmed && '完成状态待核实', ...outcomes, !outcomes.length && '未录入成果数据'].filter(Boolean).join(' · '),
      links:[...(materials.get(e.id) ?? []).flatMap(m => link(m.title,m.url)), ...w.promotions.flatMap(p =>
        link(`${p.kind === 'preview' ? '预告' : '回顾'}${p.title ? '：' + p.title : ''}${p.views == null ? '' : '（已登记阅读 ' + number(p.views) + '）'}`,p.url))],
    };
  };

  const histories = Map.groupBy(data.contributions, c => c.participant_id);
  const milestones = new Map(data.members.map(m => [m.id,firstQualificationDate(histories.get(m.id) ?? [])]));
  const qualified: string[] = [], pending: string[] = [];
  const behavior: ReportLine[] = [];
  const active = new Set<number>();
  let actions = 0;
  for (const member of data.members) {
    const history = histories.get(member.id) ?? [];
    const throughEnd = history.filter(row => !row.date || !isArticleDate(row.date) || row.date <= end);
    const date = milestones.get(member.id);
    if (within(date)) qualified.push(`${member.name}（${date}）`);
    else if (!date && throughEnd.reduce((sum, c) => sum + c.points, 0) >= COMMUNITY_EVANGELIST_POINTS) pending.push(member.name);
    const rows = history.filter(row => within(row.date)).sort((a, b) => a.date!.localeCompare(b.date!));
    if (!rows.length) continue;
    active.add(member.id);
    actions += rows.length;
    behavior.push(...rows.map(row => ({ tags:[row.category], text: `${row.date} · ${member.name} · ${row.category} / ${row.type}${row.title ? ' · ' + row.title : ''} · ${row.points} 分`, links: link('成果链接', row.url) })));
  }
  const undated = data.contributions.filter(row => !isArticleDate(row.date)).length;
  const count = (range: ReportRange) => {
    const local = data.contributions.filter(c => inRange(c.date, range));
    const publications = data.articles.filter(a => inRange(a.date, range));
    const completeGithub = github && range.start.startsWith(coverage + '-') && github.date >= range.end;
    const issues = completeGithub ? items.filter(c => c.type === 'issue' && inRange(c.created_at, range)) : [];
    const merges = completeGithub ? items.filter(c => c.type === 'pr' && c.status === 'merged' && inRange(c.merged_at, range)) : [];
    return {
      articles: publications.length, channels: segments(publications.map(a => platformName(a.platform))), events: heldIn(range).length,
      focus: articleFocus(range),
      advocates: new Set(local.map(c => c.participant_id)).size, actions: local.length,
      qualified: [...milestones.values()].filter(date => inRange(date, range)).length,
      github: completeGithub ? { people: new Set([...issues, ...merges].map(c => c.author)).size, issues: issues.length,
        submitted: items.filter(c => c.type === 'pr' && inRange(c.created_at,range)).length, merged: merges.length,
        historical: firstIn(historical,range).length, returning: firstIn(returning,range).length } : null,
    };
  };
  const analysis = analyzeOperations(period, {
    channels, categories: segments(released.map(a => a.content_category?.trim() || '未分类')),
    articleFocus: articleFocus(period),
    medianReads: median(measured.map(a => a.views!)),
    behaviors: segments(data.contributions.filter(c => within(c.date)).map(c => c.category)),
    active: active.size, actions, qualified: qualified.length, unknownDates: undated,
    completed: held.length, archived: archive.length,
    withMaterials: held.filter(e => materials.get(e.id)?.some(m => link(m.title,m.url).length)).length,
    withReach: held.filter(e => e.detail.coverage || (e.participants ?? 0) > 0).length,
    upcoming: upcoming.length,
    unassigned: activities.filter(e => ['intent','preparing','confirmed'].includes(e.detail.status) && !e.event_date && !e.detail.month).length,
    incompleteCounters: data.counters.filter(c => c.start?.value == null || c.end?.value == null || c.start.date !== shiftDate(start,-1) || c.end.date !== end).map(c => c.label),
    githubCurrent: Boolean(covered && github.date >= end),
  }, count);

  return {
    period, generatedAt,
    summary: [
      `本期看板记录了 ${released.length} 条渠道发布记录（跨渠道分别计数）。${measured.length ? `有数据的 ${measured.length} 条截至生成日累计阅读 ${number(reads)} 次。` : '暂无可汇总的阅读量。'}`,
      ...(covered ? [`主仓库快照记录到 ${contributors.size} 位有效贡献者，其中 ${newcomers.length} 位是历史首次贡献者。`] : []),
      `本期记录 ${completed.length} 场已完成活动。${archive.length ? `另有 ${archive.length} 条历史活动记录未确认完成状态。` : ''}`,
      `${active.size} 人完成了 ${actions} 项有日期的布道行为，${qualified.length} 人本期首次达到 100 分。`,
    ],
    sections: [
      ...analysis,
      { title: '内容运营', lines: [line('按实际发布日期统计；阅读量为本期所发文章截至生成时的累计值，不是本期新增阅读。'),
        ...(!released.length ? [line('本期无发布记录。')] : []),
        ...measured.sort((a, b) => b.views! - a.views!).slice(0, 5).map(a => ({
          text: `高阅读文章 · ${a.date} · ${platformName(a.platform)} · ${a.article_title} · ${number(a.views!)} 次`,
          links: link('阅读原文', a.article_url),
        })),
        line('文章按渠道记录列示。投稿来自明确的来源标记或与布道者官方供稿记录匹配的文章链接；未把一般社区来稿推定为布道者投稿。'),
      ], appendix:articleDetails },
      { title: 'GitHub 社区', lines: [...data.counters.slice(0, 2).map(counterLine), ...githubLines], appendix:covered ? contributorDetails(items,within) : [] },
      { title: '社区活动', lines: [
        line(`已完成活动 ${held.length} 场；参与人数按每场已填数据列示，不做跨活动人数去重。`),
        ...(held.length ? [line('已完成类型：' + segments(held.map(eventType)).map(t => t.label + ' ' + t.count + ' 场').join('、') + '。')] : []),
        ...(promotions.articles ? [line(`活动宣传文章 ${promotions.articles} 篇（按链接去重），已知累计阅读 ${number(promotions.views)} 次，${promotions.missing} 篇待补录。`)] : []),
        ...(archive.length ? [line(`历史记录（未标记完成，不计入已完成数）：${archive.map(e => e.event_name).join('、')}。`)] : []),
      ], appendix:[...held.map(e => eventDetails(e,true)), ...archive.map(e => eventDetails(e,false))] },
      { title: '布道者成果', lines: [
        line(`首次达到 100 分：${qualified.length ? qualified.join('、') : '本期暂无'}。`),
        ...(pending.length ? [line(`达标日期待确认（不计入本期人数）：${pending.join('、')}。`)] : []),
        ...(undated ? [line(`另有 ${undated} 条贡献缺少有效发生日期，不纳入本期行为统计。`)] : []),
        line(behavior.length ? `${active.size} 位成员有日期的布道行为 ${actions} 项，详见明细。` : '本期暂无已记录的布道行为。'),
      ], appendix:behavior },
      { title: '社交与下载', lines: data.counters.slice(2).map(counterLine) },
      { title: '下期活动计划', lines: [
        line(`${nextStart} 至 ${nextEnd}，计划 ${upcoming.length} 场（不计入本期成果）。`),
        ...upcoming.map(e => line(`${e.event_date || e.detail.month + '（日期待定）'} · ${e.event_name}`)),
      ] },
    ],
  };
}

export function reportText(doc: ReportDocument): string {
  const rowText = (row: ReportLine) => [row.text, ...row.links?.map(l => `${l.label}：${l.url}`) ?? []].join('\n');
  return [`IvorySQL 社区运营报告 · ${doc.period.label}`, `${doc.period.start} 至 ${doc.period.end}${doc.period.closed ? '' : '（周期尚未结束）'}`,
    '生成于：' + reportGeneratedAt(doc.generatedAt),
    '', '运营摘要', ...doc.summary, ...doc.sections.flatMap(s => ['', s.title,
      ...s.lines.map(rowText),
      ...(s.table ? [s.table.columns, ...s.table.rows].map(row => row.join(' | ')) : []),
      ...(s.appendix?.length ? ['明细（' + s.appendix.length + ' 条）', ...s.appendix.map(rowText)] : []),
    ])].join('\n');
}

export function reportGeneratedAt(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + '（北京时间）';
}
