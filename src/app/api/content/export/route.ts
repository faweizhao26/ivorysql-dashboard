import { getAllArticleDetailsForExport } from '@/lib/db';
import { ARTICLE_PLATFORMS, parseArticleDateRange } from '@/lib/article-query';

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const platform = params.get('platform') || undefined;
  if (platform && !ARTICLE_PLATFORMS.includes(platform as typeof ARTICLE_PLATFORMS[number])) {
    return Response.json({ error: 'Invalid platform' }, { status: 400 });
  }
  try {
    const range = parseArticleDateRange(params);
    const articles = await getAllArticleDetailsForExport(platform, range);
    const header = ['平台', '发布日期', '标题', '链接', '当前累计阅读量', '分类', '来源'];
    const rows = articles.map(article => [
      article.platform, article.published_date || article.date, article.article_title, article.article_url || '', article.views,
      article.content_category || '', article.content_source || '',
    ]);
    const csv = `\uFEFF${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`;
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ivorysql-content-${platform || 'all'}${range ? `-${range.start}-${range.end}` : ''}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ error: error.message }, { status: 400 });
    console.error('Error exporting articles:', error);
    return Response.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
