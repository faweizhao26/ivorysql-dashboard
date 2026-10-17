import { NextResponse } from 'next/server';
import { getLatestSocialStats } from '@/lib/db';

export async function GET() {
  try {
    const data = await getLatestSocialStats();
    return NextResponse.json({ ok: true, count: data.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : undefined }, { status: 500 });
  }
}
