import { NextResponse } from 'next/server';
import { getArticlePlatformSummaries } from '@/lib/db';

export async function GET() {
  try {
    const platforms = await getArticlePlatformSummaries();
    const updatedAt = platforms.reduce<string | null>((latest, item) => {
      if (!item.updated_at) return latest;
      return !latest || item.updated_at > latest ? item.updated_at : latest;
    }, null);
    return NextResponse.json({ platforms, updated_at: updatedAt });
  } catch (error) {
    console.error('Error fetching content summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
