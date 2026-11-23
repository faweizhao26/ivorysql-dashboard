import { eventAccess } from '@/lib/event-access';
import { queryDb } from '@/lib/db';
import { publicationCsv, type PublicationExportRow } from '@/lib/publication-csv';

export async function GET(request: Request) {
  if (await eventAccess() !== 'admin') return Response.json({ error: '仅管理员可导出发布记录' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const sheet = params.get('sheet'), year = params.get('year');
  if ((sheet !== 'plan' && sheet !== 'actual') || (year !== null && !/^[1-9]\d{3}$/.test(year))) {
    return Response.json({ error: '导出类型或年份无效' }, { status: 400 });
  }
  const values = year ? [year+'-01-01',year+'-12-31'] : [];
  try {
    let records: PublicationExportRow[];
    if (sheet === 'plan') {
      const filter = year ? 'WHERE planned_date BETWEEN $1 AND $2' : '';
      records = (await queryDb(`SELECT planned_date AS date,title,channels FROM content_publication_plans
        ${filter} ORDER BY planned_date DESC NULLS LAST,id DESC`,values)).rows;
    } else {
      const filter = year ? 'WHERE pub_date BETWEEN $1 AND $2' : '';
      records = (await queryDb(`WITH published AS (
        SELECT COALESCE(NULLIF(published_date,''),date) AS pub_date, article_title, platform FROM article_details
      ) SELECT pub_date AS date, article_title AS title, array_agg(DISTINCT platform) AS channels
        FROM published ${filter} GROUP BY pub_date, article_title ORDER BY pub_date DESC, article_title`,values)).rows;
    }
    const filename = (year || '历年') + ' IvorySQL 内容' + (sheet === 'plan' ? '发布排期' : '实际发布') + '.csv';
    return new Response(publicationCsv(sheet,year,records), { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control':'private, no-store',
      'Content-Disposition': `attachment; filename="ivorysql-${sheet}-${year || 'all'}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }});
  } catch (error) {
    console.error('Publication CSV export failed:', error);
    return Response.json({ error: '导出失败，请重试' }, { status: 500 });
  }
}
