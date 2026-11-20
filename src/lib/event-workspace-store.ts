import { withDbTransaction, type ActivityEventParsed } from './db';
import { DEFAULT_TASK_TEMPLATES, readWorkspace, validateWorkspace, validateTasks, type EventPromotion } from './event-workspace';
import { isArticleDate } from './content-values.mjs';

export class EventConflict extends Error {}
export class EventNotFound extends Error {}
function collectedData(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') { try { return collectedData(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export async function listWorkspaceEvents(): Promise<ActivityEventParsed[]> {
  return withDbTransaction(async client => {
    const result = await client.query('SELECT * FROM activity_events ORDER BY event_date DESC, id DESC');
    const events = result.rows.map(row => ({ ...row, updated_at: new Date(row.updated_at).toISOString(), collected_data: collectedData(row.collected_data) }));
    const urls = [...new Set(events.flatMap(e => readWorkspace(e).promotions.map(p => p.url)))];
    if (urls.length) {
      const articles = await client.query('SELECT DISTINCT ON (article_url) article_url, views, updated_at FROM article_details WHERE article_url=ANY($1::text[]) ORDER BY article_url, updated_at DESC, id DESC', [urls]);
      const byUrl = new Map(articles.rows.map(a => [a.article_url, a]));
      for (const e of events) {
        const w = readWorkspace(e);
        if (!e.collected_data.workspace) continue;
        w.promotions = w.promotions.map((p: EventPromotion) => { const a = byUrl.get(p.url); return a ? { ...p, views: a.views ?? p.views, updated_at: a.updated_at ? new Date(a.updated_at).toISOString() : p.updated_at, linked: true } : p; });
        e.collected_data = { ...e.collected_data, workspace: w };
      }
    }
    return events;
  });
}
function string(value: unknown, max: number) { if (typeof value !== 'string' || value.length > max) throw new RangeError('活动文本格式错误或过长'); return value.trim(); }
function number(value: unknown) { if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483647) throw new RangeError('人数必须为非负整数'); return value; }
export async function writeWorkspaceEvent(input: Record<string, unknown>, id?: number, transaction: typeof withDbTransaction = withDbTransaction): Promise<number> {
  return transaction(async client => {
    const old = id ? (await client.query('SELECT * FROM activity_events WHERE id=$1 FOR UPDATE', [id])).rows[0] : null;
    if (id && !old) throw new EventNotFound('活动不存在');
    if (old && input.updated_at && new Date(String(input.updated_at)).getTime() !== new Date(old.updated_at).getTime()) throw new EventConflict('活动已被其他操作修改，请重新打开后编辑');
    const base = { ...old, ...input };
    const name = string(base.event_name, 300); if (!name) throw new RangeError('请填写活动名称');
    const eventDate = string(base.event_date ?? '', 10); if (eventDate && !isArticleDate(eventDate)) throw new RangeError('活动日期无效');
    const type = string(base.event_type, 40); if (!['conference', 'meetup', 'webinar', 'workshop', 'hackathon', 'campus', 'campaign', 'other'].includes(type)) throw new RangeError('活动类型无效');
    const previousData = collectedData(old?.collected_data);
    const incomingData = input.collected_data && typeof input.collected_data === 'object' && !Array.isArray(input.collected_data) ? input.collected_data as Record<string, unknown> : {};
    const data = { ...previousData, ...incomingData };
    if (data.workspace) {
      const w = validateWorkspace(data.workspace), previous = old ? readWorkspace({ collected_data: previousData }) : null;
      if (w.end_date && (!eventDate || w.end_date < eventDate)) throw new RangeError('结束日期不能早于开始日期');
      if (eventDate) w.month = eventDate.slice(0, 7);
      w.original_month = previous?.original_month || previous?.month || w.month;
      const from = old?.event_date || previous?.month || '', to = eventDate || w.month;
      w.schedule_history = previous?.schedule_history || [];
      if (old && from !== to) w.schedule_history = [...w.schedule_history.slice(-99), { from, to, changed_at: new Date().toISOString() }];
      data.workspace = w;
    } else if (!eventDate) throw new RangeError('请填写活动日期');
    const url = string(base.url || '', 2000);
    if (url) { let parsed: URL; try { parsed = new URL(url); } catch { throw new RangeError('活动链接无效'); } if (!['http:', 'https:'].includes(parsed.protocol)) throw new RangeError('活动链接须为 http 或 https'); }
    const values = [name, eventDate, type, string(base.location || '', 200), string(base.venue || '', 300), number(base.participants ?? 0), number(base.registrations ?? 0), number(base.online_viewers ?? 0), JSON.stringify(data), string(base.description || '', 8000), url || null];
    if (id) {
      await client.query('UPDATE activity_events SET event_name=$1,event_date=$2,event_type=$3,location=$4,venue=$5,participants=$6,registrations=$7,online_viewers=$8,collected_data=$9,description=$10,url=$11,updated_at=CURRENT_TIMESTAMP WHERE id=$12', [...values, id]);
      return id;
    }
    return Number((await client.query('INSERT INTO activity_events (event_name,event_date,event_type,location,venue,participants,registrations,online_viewers,collected_data,description,url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id', values)).rows[0].id);
  });
}
export async function getTaskTemplates(): Promise<Record<string, string[]>> {
  return withDbTransaction(async client => {
    const rows = (await client.query('SELECT template_key,tasks FROM activity_task_templates ORDER BY template_key')).rows;
    return { ...DEFAULT_TASK_TEMPLATES, ...Object.fromEntries(rows.map(row => [row.template_key, row.tasks])) };
  });
}
export async function saveTaskTemplate(key: string, titles: unknown) {
  if (!Object.hasOwn(DEFAULT_TASK_TEMPLATES, key)) throw new RangeError('模板类型无效');
  if (!Array.isArray(titles)) throw new RangeError('任务模板格式错误');
  const tasks = validateTasks(titles.map((title, i) => ({ id: String(i), title }))).map(t => t.title);
  await withDbTransaction(client => client.query('INSERT INTO activity_task_templates (template_key,tasks) VALUES ($1,$2::jsonb) ON CONFLICT (template_key) DO UPDATE SET tasks=EXCLUDED.tasks,updated_at=CURRENT_TIMESTAMP', [key, JSON.stringify(tasks)]));
}
