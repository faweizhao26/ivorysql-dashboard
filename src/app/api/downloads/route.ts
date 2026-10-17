import { NextResponse } from 'next/server';
import { getDownloadSummary } from '@/lib/download-stats';

export async function GET() {
  try {
    const result = await getDownloadSummary();
    return NextResponse.json(result, { status: result.partial ? 502 : 200 });
  } catch (error) {
    console.error('Download statistics error:', error);
    return NextResponse.json({ error: '下载统计暂时不可用' }, { status: 502 });
  }
}
