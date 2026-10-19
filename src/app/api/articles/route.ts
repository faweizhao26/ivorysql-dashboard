import { NextResponse } from 'next/server';
import { getBeijingDate, shiftDate } from '@/lib/date';
import { 
  getArticleDetailsByPlatform, 
  getArticleDetailsForDate,
  getLatestArticleDetails,
  getAllArticleDetailsPlatforms,
  ArticleDetails
} from '@/lib/db';
import { parseArticleInput, parseArticleId } from '@/lib/article-input';
import { mutateManualArticle, ArticleNotFoundError } from '@/lib/manual-articles';

export function parseArticleDetailsInput(body: unknown): ArticleDetails {
  return parseArticleInput(body);
}

function mutationError(error: unknown) {
  if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof ArticleNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return NextResponse.json({ error: '目标平台已存在相同链接或同名文章，请编辑原有记录' }, { status: 409 });
  }
  console.error('Article mutation failed:', error);
  return NextResponse.json({ error: '文章操作失败，未保存任何更改，请重试' }, { status: 500 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const endDate = searchParams.get('end') || getBeijingDate();
  const startDateParam = searchParams.get('start');
  
  let startDate: string;
  if (startDateParam) {
    startDate = startDateParam;
  } else {
    const days = parseInt(searchParams.get('days') || '30', 10);
    startDate = shiftDate(endDate, -days);
  }

  const platform = searchParams.get('platform');
  const fetchAll = searchParams.get('all') === 'true';
  const isSingleDay = startDate === endDate && startDateParam !== null;

  try {
    if (platform) {
      if (fetchAll) {
        const data = await getArticleDetailsByPlatform(platform, 365);
        return NextResponse.json({ 
          platform, 
          data,
          isArchive: false
        });
      }
      if (isSingleDay) {
        const data = await getArticleDetailsForDate(startDate);
        const latest = await getLatestArticleDetails(platform);
        return NextResponse.json({ 
          platform, 
          data,
          latest,
          isArchive: isSingleDay,
          archiveDate: startDate
        });
      }
      const data = await getArticleDetailsByPlatform(platform, 365);
      const filtered = data.filter((d) => d.date >= startDate && d.date <= endDate);
      return NextResponse.json({ platform, data: filtered });
    }

    const platforms = await getAllArticleDetailsPlatforms();
    const allData: Record<string, ArticleDetails[]> = {};
    const maxDays = 3650; // 10 years - get all data

    for (const p of platforms) {
      const data = await getArticleDetailsByPlatform(p, maxDays);
      const filtered = data.filter((d) => d.date >= startDate && d.date <= endDate);
      if (filtered.length > 0) {
        allData[p] = filtered;
      }
    }

    return NextResponse.json({
      platforms,
      articles: allData
    });
  } catch (error) {
    console.error('Error fetching article details:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const article = parseArticleDetailsInput(body);
    await mutateManualArticle({ type: 'create', article });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mutationError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = parseArticleId(body?.id);
    const article = parseArticleInput(body, true);
    await mutateManualArticle({ type: 'update', id, article });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mutationError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseArticleId(searchParams.get('id'));
    await mutateManualArticle({ type: 'delete', id });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return mutationError(error);
  }
}
