import { NextResponse } from 'next/server';
import { getLatestSyncStatus } from '@/lib/sync-runs';

export async function GET() {
  try {
    const platforms = await getLatestSyncStatus();
    return NextResponse.json(
      { platforms },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }
}
