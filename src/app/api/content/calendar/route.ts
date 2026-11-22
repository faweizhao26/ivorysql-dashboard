import { eventAccess } from '@/lib/event-access';
import { parseArticleId } from '@/lib/article-input';
import { parsePlan, parsePublication } from '@/lib/publication';
import { getBeijingDate } from '@/lib/date';
import { queryDb, recalculateArticleStatsForDate, withDbTransaction } from '@/lib/db';

const denied = () => Response.json({ error: '仅管理员可管理内容排期' }, { status: 403 });
function failure(e: unknown) {
  if (e instanceof RangeError || e instanceof SyntaxError) return Response.json({ error: e.message }, { status: 400 });
  if (e && typeof e === 'object' && 'code' in e) {
    if (e.code === '23505') return Response.json({ error: '此渠道已登记该文章，请到原文章列表查看。' }, { status: 409 });
    if (e.code === '23503') return Response.json({ error: '关联排期已不存在，请重新选择或独立登记。' }, { status: 409 });
  }
  console.error('Content calendar:', e);
  return Response.json({ error: '内容日历操作失败，请重试。' }, { status: 500 });
}
export async function GET() {
  if (await eventAccess() !== 'admin') return denied();
  try { return Response.json((await queryDb('SELECT id,title,planned_date,channels FROM content_publication_plans ORDER BY planned_date DESC NULLS LAST,id DESC')).rows); } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  if (await eventAccess() !== 'admin') return denied();
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RangeError('请求格式无效');
    if (body.action === 'register') {
      const a = parsePublication(body, getBeijingDate());
      await withDbTransaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['article-sync:' + a.platform]);
        await client.query(`INSERT INTO article_details(date,published_date,platform,article_title,article_url,views,likes,comments,publication_plan_id)
          VALUES($1,$1,$2,$3,$4,NULL,NULL,NULL,$5)`, [a.date,a.platform,a.title,a.url,a.planId]);
        await recalculateArticleStatsForDate(a.platform, a.date, (sql, values) => client.query(sql, values));
      });
    } else if (body.action === 'plan') {
      const p = parsePlan(body);
      if (body.id == null) await queryDb('INSERT INTO content_publication_plans(title,planned_date,channels) VALUES($1,$2,$3)', [p.title,p.planned_date,p.channels]);
      else if (!(await queryDb('UPDATE content_publication_plans SET title=$1,planned_date=$2,channels=$3 WHERE id=$4', [p.title,p.planned_date,p.channels,parseArticleId(body.id)])).rowCount) return Response.json({ error: '排期不存在' }, { status: 404 });
    } else throw new RangeError('操作类型无效');
    return Response.json({ success: true });
  } catch (e) { return failure(e); }
}
export async function DELETE(request: Request) {
  if (await eventAccess() !== 'admin') return denied();
  try {
    const id = parseArticleId(new URL(request.url).searchParams.get('id'));
    await queryDb('DELETE FROM content_publication_plans WHERE id=$1', [id]);
    return Response.json({ success: true });
  } catch (e) { return failure(e); }
}
