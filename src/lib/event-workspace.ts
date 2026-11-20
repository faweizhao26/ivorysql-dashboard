import { isArticleDate } from './content-values.mjs';

export const EVENT_STAGES = { recorded: '历史记录', intent: '意向', preparing: '筹备中', confirmed: '已确定', completed: '已完成', cancelled: '已取消' } as const;
export type EventStage = keyof typeof EVENT_STAGES;
export interface EventTask { id: string; title: string; owner: string; due: string; done: boolean }
export interface EventPromotion { id: string; kind: 'preview' | 'recap'; title: string; platform: string; url: string; views: number | null; updated_at: string; linked?: boolean }
export interface EventWorkspace {
  status: EventStage; visibility: 'internal' | 'public'; month: string; original_month: string;
  end_date: string; actual_date: string; owner: string; format: string; role: string; participation: string;
  partners: string[]; series: string; target_participants: number | null; target_leads: number | null;
  leads: number | null; coverage: string; coverage_scope: string; notes: string;
  tasks: EventTask[]; promotions: EventPromotion[];
  schedule_history: { from: string; to: string; changed_at: string }[];
}
export const DEFAULT_TASK_TEMPLATES: Record<string, string[]> = {
  meetup: ['确认场地与预算', '邀请讲师并确认议题', '制作海报与报名页', '发布活动宣传', '确认现场分工', '收集 PPT、照片与回顾'],
  campus: ['确认合作学校与场地', '确认讲师与课程', '准备演示环境', '启动校内宣传', '确认志愿者分工', '整理课件与反馈'],
  webinar: ['确认讲师与主题', '确认直播平台与时间', '制作海报与报名页', '发布直播预告', '设备测试与彩排', '整理回放与课件'],
  conference: ['确认参会方式', '确认议题与讲师', '准备展台和宣传物料', '确认人员与差旅', '核对现场执行清单', '整理留资与总结'],
  campaign: ['确定活动规则与目标', '准备活动页面', '发布活动宣传', '跟进参与情况', '确认活动结果', '整理成果与回顾'],
};
export function defaultWorkspace(): EventWorkspace {
  return { status: 'intent', visibility: 'internal', month: '', original_month: '', end_date: '', actual_date: '', owner: '', format: '', role: '', participation: '', partners: [], series: '', target_participants: null, target_leads: null, leads: null, coverage: '', coverage_scope: '', notes: '', tasks: [], promotions: [], schedule_history: [] };
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, max = 200): string {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new RangeError('文本内容过长或格式错误');
  return value.trim();
}
function metric(value: unknown, label: string): number | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2147483647) throw new RangeError(`${label}必须为非负整数`);
  return value;
}
function date(value: unknown): string { const s = text(value, 10); if (s && !isArticleDate(s)) throw new RangeError('日期格式错误'); return s; }
function month(value: unknown): string { const s = text(value, 7); if (s && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s) || !isArticleDate(`${s}-01`))) throw new RangeError('计划月份格式错误'); return s; }
function array(value: unknown, limit: number): unknown[] { if (value == null) return []; if (!Array.isArray(value) || value.length > limit) throw new RangeError('条目数量超出上限'); return value; }
export function validateTasks(value: unknown): EventTask[] {
  const ids = new Set<string>();
  return array(value, 100).map(item => { const r = record(item), id = text(r.id, 80), title = text(r.title, 200); if (!id || !title) throw new RangeError('任务名称和标识不能为空'); if (ids.has(id)) throw new RangeError('任务标识重复'); ids.add(id); if (r.done !== undefined && typeof r.done !== 'boolean') throw new RangeError('任务状态格式错误'); return { id, title, owner: text(r.owner), due: date(r.due), done: r.done === true }; });
}
export function validateWorkspace(value: unknown): EventWorkspace {
  const r = record(value), w = defaultWorkspace();
  if (r.status !== undefined && !Object.hasOwn(EVENT_STAGES, String(r.status))) throw new RangeError('活动阶段错误');
  if (r.visibility !== undefined && !['public', 'internal'].includes(String(r.visibility))) throw new RangeError('可见范围错误');
  w.status = (r.status ?? w.status) as EventStage; w.visibility = (r.visibility ?? w.visibility) as EventWorkspace['visibility'];
  w.month = month(r.month); w.original_month = month(r.original_month); w.end_date = date(r.end_date); w.actual_date = date(r.actual_date);
  for (const key of ['owner', 'participation', 'series', 'coverage_scope'] as const) w[key] = text(r[key]);
  w.notes = text(r.notes, 4000); w.format = text(r.format); w.role = text(r.role);
  if (w.format && !['线上', '线下', '混合'].includes(w.format)) throw new RangeError('活动形式错误');
  if (w.role && !['主办', '参与', '协办'].includes(w.role)) throw new RangeError('主办/参与格式错误');
  w.partners = [...new Set(array(r.partners, 30).map(p => text(p)).filter(Boolean))];
  w.target_participants = metric(r.target_participants, '预计人数'); w.target_leads = metric(r.target_leads, '目标留资'); w.leads = metric(r.leads, '留资数量');
  w.coverage = text(r.coverage, 20); if (w.coverage && !/^\d+(?:\+)?$/.test(w.coverage)) throw new RangeError('覆盖人数请填写整数或 200+ 形式');
  w.tasks = validateTasks(r.tasks);
  const promotionIds = new Set<string>();
  w.promotions = array(r.promotions, 100).map(item => {
    const p = record(item), id = text(p.id, 80), url = text(p.url, 2000); let parsed: URL;
    try { parsed = new URL(url); } catch { throw new RangeError('宣传文章链接无效'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new RangeError('宣传文章链接须为 http 或 https');
    if (!id || promotionIds.has(id)) throw new RangeError('宣传文章标识重复或为空'); promotionIds.add(id);
    if (!['preview', 'recap'].includes(String(p.kind))) throw new RangeError('宣传文章类型错误');
    return { id, kind: p.kind as EventPromotion['kind'], title: text(p.title), platform: text(p.platform), url, views: metric(p.views, '阅读量'), updated_at: text(p.updated_at, 40), ...(p.linked === true ? { linked: true } : {}) };
  });
  w.schedule_history = array(r.schedule_history, 100).map(item => { const h = record(item); return { from: text(h.from, 10), to: text(h.to, 10), changed_at: text(h.changed_at, 40) }; });
  return w;
}
export function readWorkspace(event: { collected_data?: unknown }): EventWorkspace {
  let data = event.collected_data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  const raw = record(data).workspace;
  if (!raw) return { ...defaultWorkspace(), status: 'recorded', visibility: 'public' };
  try { return validateWorkspace(raw); } catch { return defaultWorkspace(); }
}
export function publicEvent<T extends { event_date: string; collected_data?: unknown }>(event: T) {
  const w = readWorkspace(event);
  if (w.visibility !== 'public' || !['recorded', 'confirmed', 'completed'].includes(w.status) || !event.event_date) return null;
  return { ...event, collected_data: { workspace: { status: w.status, visibility: w.visibility, end_date: w.end_date, format: w.format, role: w.role, series: w.series } } };
}
export interface WorkspaceFilters { year?: string; month?: string; type?: string; role?: string; format?: string; status?: string; series?: string; search?: string; unscheduled?: boolean }
export function eventMatches(event: { event_name: string; event_date: string; event_type: string; location?: string; collected_data?: unknown }, filters: WorkspaceFilters): boolean {
  const w = readWorkspace(event), scheduled = event.event_date || w.month;
  if (filters.unscheduled && scheduled) return false;
  if (filters.year && !(event.event_date ? event.event_date <= `${filters.year}-12-31` && (w.end_date || event.event_date) >= `${filters.year}-01-01` : scheduled.startsWith(filters.year))) return false;
  if (filters.month && !(event.event_date ? event.event_date <= `${filters.month}-31` && (w.end_date || event.event_date) >= `${filters.month}-01` : w.month === filters.month)) return false;
  if (filters.type && event.event_type !== filters.type || filters.role && w.role !== filters.role || filters.format && w.format !== filters.format || filters.status && w.status !== filters.status) return false;
  if (filters.series && w.series !== filters.series) return false;
  return !filters.search || `${event.event_name} ${event.location || ''} ${w.owner} ${w.series} ${w.partners.join(' ')}`.toLowerCase().includes(filters.search.toLowerCase());
}
export function eventProgress(workspace: EventWorkspace): number { return workspace.tasks.length ? Math.round(workspace.tasks.filter(t => t.done).length / workspace.tasks.length * 100) : 0; }
export function promotionSummary(workspaces: EventWorkspace[]) {
  const unique = new Map<string, number | null>();
  for (const p of workspaces.flatMap(w => w.promotions)) { const old = unique.get(p.url); unique.set(p.url, p.views == null ? old ?? null : Math.max(old ?? 0, p.views)); }
  return { articles: unique.size, views: [...unique.values()].reduce<number>((n, views) => n + (views ?? 0), 0), missing: [...unique.values()].filter(v => v == null).length };
}
