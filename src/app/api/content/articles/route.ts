import { NextResponse } from 'next/server';
import { getPagedArticleDetails } from '@/lib/db';
import { parseArticleListParams } from '@/lib/article-query';

export async function GET(request: Request) {
  try {
    const params = parseArticleListParams(new URL(request.url).searchParams);
    const result = await getPagedArticleDetails(params);
    return NextResponse.json({ ...result, page: params.page, pageSize: params.pageSize });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching paged articles:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
