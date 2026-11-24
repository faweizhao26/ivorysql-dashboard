import { eventAccess } from '@/lib/event-access';
import { getBeijingDate } from '@/lib/date';
import { reportPeriod } from '@/lib/report-period';
import { finalizeOperationsDraft, generateOperationsReport, getOperationsReport, saveOperationsDraft } from '@/lib/operations-report-store';

const headers = { 'Cache-Control': 'private, no-store' };
const deny = () => Response.json({ error: '仅管理员可查看运营报告' }, { status: 403, headers });

function fail(error: unknown) {
  if (error instanceof RangeError || error instanceof SyntaxError) return Response.json({ error: error instanceof SyntaxError ? '请求格式无效' : error.message }, { status: 400, headers });
  console.error('Operations report:', error);
  return Response.json({ error: '运营报告暂不可用，请重试' }, { status: 500, headers });
}

export async function GET(request: Request) {
  if (await eventAccess() !== 'admin') return deny();
  try {
    const query = new URL(request.url).searchParams;
    const period = reportPeriod(query.get('kind'), query.get('key'), getBeijingDate());
    const saved = await getOperationsReport(period);
    return Response.json(saved ?? { document: await generateOperationsReport(period), revision: null, finalized_at: null }, { headers });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  if (await eventAccess() !== 'admin') return deny();
  try {
    const body = await request.json();
    const period = reportPeriod(body?.kind, body?.key, getBeijingDate());
    if (body.action === 'generate') return Response.json(await saveOperationsDraft(period), { headers });
    if (body.action !== 'finalize' || typeof body.revision !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.revision)) throw new RangeError('请先保存草稿');
    const saved = await finalizeOperationsDraft(period, body.revision);
    return saved ? Response.json(saved, { headers }) : Response.json({ error: '草稿已变更或定稿，请重新加载后确认' }, { status: 409, headers });
  } catch (error) { return fail(error); }
}
