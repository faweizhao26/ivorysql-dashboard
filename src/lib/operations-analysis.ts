import { compareReportPeriod, reportTrendRanges, type ReportPeriod, type ReportRange } from './report-period';
import type { ReportSection, ReportTable } from './operations-report';

export const reportNumber = (value: number) => value.toLocaleString('zh-CN');
export function reportPercent(n: number, total: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(n / total);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Counts = {
  articles: number; events: number; advocates: number; actions: number;
  qualified: number;
  channels: Segment[];
  focus: Segment[];
  github: { people: number; issues: number; submitted: number; merged: number; historical: number; returning: number } | null;
};
type Channel = { label: string; articles: number; measured: number; reads: number; median: number | null };
type Segment = { label: string; count: number };
type Facts = {
  channels: Channel[];
  medianReads: number | null;
  categories: Segment[];
  articleFocus: Segment[];
  behaviors: Segment[];
  active: number;
  actions: number;
  qualified: number;
  unknownDates: number;
  completed: number;
  archived: number;
  withMaterials: number;
  withReach: number;
  upcoming: number;
  unassigned: number;
  incompleteCounters: string[];
  githubCurrent: boolean;
};

export function analyzeOperations(period: ReportPeriod, facts: Facts, count: (range: ReportRange) => Counts): ReportSection[] {
  const { current, prior } = compareReportPeriod(period);
  const previous = count(prior);
  const comparable = count(current);
  const hasPrevious = previous.articles + previous.events + previous.actions > 0;
  const interval = (r: ReportRange) => r.start + ' 至 ' + r.end;
  const display = (n: number | null | undefined) => n == null ? '—' : reportNumber(n);
  const signed = (n: number) => (n > 0 ? '+' : '') + reportNumber(n);
  const comparison = (label: string, now: number | null, before: number | null) => {
    const delta = now === null || before === null ? null : now - before;
    return [label, display(now), display(before), delta === null ? '—' : signed(delta),
      delta !== null && before !== null && before > 0 ? (delta > 0 ? '+' : '') + reportPercent(delta,before) : '—'];
  };
  const total = facts.channels.reduce((s, c) => s + c.articles, 0);
  const measured = facts.channels.reduce((s, c) => s + c.measured, 0);
  const reads = facts.channels.reduce((s, c) => s + c.reads, 0);
  const byRead = [...facts.channels].sort((a, b) => b.reads - a.reads);
  const top = byRead[0];
  const formatSegments = (segments: Segment[]) => segments.map(s => `${s.label} ${s.count}`).join('、');
  const channelChanges = [...new Set([...comparable.channels,...previous.channels].map(c => c.label))].map(label => ({
    label,
    now: comparable.channels.find(c => c.label === label)?.count ?? 0,
    before: previous.channels.find(c => c.label === label)?.count ?? 0,
  })).sort((a,b) => Math.abs(b.now-b.before) - Math.abs(a.now-a.before));
  const changed = channelChanges.filter(c => c.now !== c.before).slice(0,3);
  const comparableGithub = comparable.github && previous.github;

  const comparisons = [
    `对照范围：本期 ${interval(current)}；上期 ${interval(prior)}。${period.closed ? '按完整自然周期对照。' : '按两个周期相同的已过天数对照。'}对比的是看板记录，不代表未录入的实际工作。`,
    '变化率以上期为基数；上期为零或数据不可比时不计算。0 表示看板中没有对应记录，— 表示没有可比值。',
    ...(!hasPrevious ? ['上期暂无内容、活动或布道的可用记录，不判断这些指标的增长或下降。'] : []),
    ...(!comparableGithub ? ['主仓库贡献快照未覆盖两个完整对照范围，不判断 GitHub 活动量环比。'] : []),
  ];
  const priorValue = (value: number) => hasPrevious ? value : null;
  const comparisonRows = [
    comparison('渠道发布记录（条）', comparable.articles, priorValue(previous.articles)),
    ...comparable.focus.map(item => comparison(item.label + '（发布记录）', item.count, previous.articles ? previous.focus.find(f => f.label === item.label)?.count ?? 0 : null)),
    comparison('已完成活动（场）', comparable.events, priorValue(previous.events)),
    comparison('布道行为（项）', comparable.actions, priorValue(previous.actions)),
    comparison('有行为记录的布道成员（人）', comparable.advocates, priorValue(previous.advocates)),
    comparison('首次达 100 分（人）', comparable.qualified, priorValue(previous.qualified)),
    comparison('有效贡献者（人）', comparable.github?.people ?? null, previous.github?.people ?? null),
    comparison('历史首次贡献者（人）', comparable.github?.historical ?? null, previous.github?.historical ?? null),
    comparison('往年贡献过、本年首次（人）', comparable.github?.returning ?? null, previous.github?.returning ?? null),
    comparison('新建 Issue（条）', comparable.github?.issues ?? null, previous.github?.issues ?? null),
    comparison('提交 PR（条）', comparable.github?.submitted ?? null, previous.github?.submitted ?? null),
    comparison('合并 PR（条）', comparable.github?.merged ?? null, previous.github?.merged ?? null),
  ];

  const trend = reportTrendRanges(period).map(r => {
    const c = count(r);
    return [`${r.start.slice(5)} 至 ${r.end.slice(5)}`, display(c.articles), display(c.events), display(c.actions), display(c.github?.people)];
  });
  const content = [
    ...(total ? [`覆盖 ${facts.channels.length} 个渠道，${measured}/${total} 条发布记录已有阅读量（${reportPercent(measured,total)}）。`] : ['本期未录入发布记录，暂不能判断内容供给和渠道表现。']),
    ...(facts.categories.length ? [`发布记录按内容分类：${formatSegments(facts.categories)}。跨渠道分别计数。`] : []),
    ...(total ? [`重点内容：${formatSegments(facts.articleFocus)}。技术文章、演讲整理和投稿标签可重叠，不能相加作为总发文量。`] : []),
    ...(reads > 0 ? [
      `${top.label}以 ${reportNumber(top.reads)} 次累计阅读占已知阅读量 ${reportPercent(top.reads,reads)}（该渠道 ${top.measured}/${top.articles} 条有阅读数）。这一占比描述已记录表现，不代表渠道效率或因果关系。`,
    ] : []),
    ...(measured ? [`已有读数的记录中，平均累计阅读 ${reportNumber(Math.round(reads / measured))} 次，中位数 ${display(facts.medianReads)} 次；中位数较少受个别高阅读文章影响。文章上线时长不同，阅读量不作环比。`] : []),
    ...(previous.articles && changed.length ? [`对照区间内发文变化较大的渠道：${changed.map(c => `${c.label} ${c.before} → ${c.now} 条（${signed(c.now-c.before)}）`).join('、')}。`] : []),
  ];
  const situation = [
    facts.actions ? `布道参与：${facts.active} 人共留下 ${facts.actions} 项记录，其中本期首次达 100 分 ${facts.qualified} 人。行为构成：${formatSegments(facts.behaviors)}。`
      : '布道参与：本期暂无有日期的布道记录，不能据此判断成员没有参与。',
    `活动复盘：${facts.completed} 场已完成活动中，${facts.withReach} 场已录入覆盖人数，${facts.withMaterials} 场有素材链接。${facts.archived ? `另有 ${facts.archived} 条历史记录未确认完成。` : ''}`,
    `下期准备：已排入 ${facts.upcoming} 场计划，另有 ${facts.unassigned} 场尚未定月份。`,
    ...(facts.incompleteCounters.length ? [`快照缺口：${facts.incompleteCounters.join('、')}未覆盖本期边界；不把非同期的快照差额写成完整周期增长。`] : []),
  ];
  const next = [
    ...(total > measured ? [`补齐 ${total - measured} 条缺失阅读量，再复核渠道贡献排序。`] : []),
    ...(facts.archived || facts.withReach < facts.completed || facts.withMaterials < facts.completed ? ['核对历史活动是否实际举办，补齐已完成活动的覆盖人数与素材，用于下一期复盘。'] : []),
    ...(facts.unknownDates ? [`补齐 ${facts.unknownDates} 条布道记录的日期，再核对月度达标归属。`] : []),
    ...(facts.unassigned ? [`给 ${facts.unassigned} 场未排期活动确认月份、负责人和下一项筹备任务。`] : []),
    ...(!facts.githubCurrent || facts.incompleteCounters.length ? ['优先补核同步或历史快照缺口，再据此调整运营目标。'] : []),
    ...(reads > 0 ? [`复盘${top.label}的高阅读选题与分发方式，用相近上线天数的小样本做下期验证。`] : []),
  ];
  const strengths = [
    ...(previous.articles > 0 && comparable.articles > previous.articles ? [`发文记录比可比上期多 ${comparable.articles - previous.articles} 条；可继续复盘新增发布来自哪些渠道和选题。`] : []),
    ...(facts.withMaterials ? [`${facts.withMaterials} 场已完成活动留有可复用素材，可用于后续宣传或新人资料。`] : []),
    ...(facts.qualified ? [`本期 ${facts.qualified} 位成员首次达 100 分，可从布道明细定位他们形成的成果。`] : []),
    ...(comparable.github && previous.github && comparable.github.people > previous.github.people
      ? [`可比范围有效贡献者多 ${comparable.github.people - previous.github.people} 人，可结合首次贡献者和具体 Issue、PR 检查增长来源。`] : []),
  ];
  const limitations = [
    ...(previous.articles > 0 && comparable.articles < previous.articles ? [`可比范围发文记录少 ${previous.articles - comparable.articles} 条；先核对已发未登记、排期延后及渠道调整，再判断原因。`] : []),
    ...(total > measured ? [`${total - measured} 条发布记录缺阅读量，渠道排名只能代表已录入样本。`] : []),
    ...(facts.completed > facts.withReach || facts.completed > facts.withMaterials ? [`已完成活动中 ${facts.completed - facts.withReach} 场缺覆盖人数，${facts.completed - facts.withMaterials} 场缺素材链接。`] : []),
    ...(facts.unknownDates ? [`${facts.unknownDates} 条布道记录缺日期，不能归入任一周期。`] : []),
    ...(!comparableGithub ? ['贡献快照不支持完整上期对照，暂不能判断社区贡献者增长。'] : []),
  ];
  const section = (title: string, lines: string[], table?: ReportTable): ReportSection => ({ title, lines: lines.map(text => ({ text })), ...(table ? { table } : {}) });
  return [
    section('数据对比', comparisons, { columns: ['指标','本期','上期','净变化','变化率'], rows: comparisonRows }),
    section(period.kind === 'month' ? '期内趋势（每 7 天）' : '期内趋势（按月）', ['贡献者人数各段独立去重，不可相加作为本期总人数。'], {
      columns: ['时间','发布记录（条）','活动（场）','布道（项）','有效贡献者（人）'], rows: trend,
    }),
    section('内容表现分析', content, total ? {
      columns: ['渠道','发布（条）','有读数 / 发布','累计阅读','单篇中位数'],
      rows: byRead.map(c => [c.label, display(c.articles), `${c.measured} / ${c.articles}`, c.measured ? display(c.reads) : '—', display(c.median)]),
    } : undefined),
    section('现状总结', situation),
    section('值得延续', strengths.length ? strengths : ['现有记录暂不足以判断哪项做法值得扩大，先核对发布、活动与贡献记录。']),
    section('不足与待核实', limitations.length ? limitations : ['本期未从现有记录发现明显缺口；仍需通过实际反馈验证成效。']),
    section('下期建议', next.length ? next : ['延续本期已记录的工作，下一期复核活动、内容和布道产出的变化。']),
  ];
}
