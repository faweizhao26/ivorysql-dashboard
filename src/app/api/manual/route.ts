import { NextResponse } from 'next/server';
import { getManualData, queryDb } from '@/lib/db';
import { buildManualWrite, isDataCategory } from '@/lib/manual-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? undefined;
  const daysText = searchParams.get('days') ?? '90';
  const days = Number(daysText);
  if ((category !== undefined && !isDataCategory(category)) ||
      !/^\d+$/.test(daysText) || !Number.isSafeInteger(days) || days < 1 || days > 3650) {
    return NextResponse.json({ error: 'Invalid category or days; days must be an integer from 1 to 3650' }, { status: 400 });
  }

  try {
    const data = await getManualData(category, days);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching manual data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let write: ReturnType<typeof buildManualWrite>;
  try {
    write = buildManualWrite(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RangeError ? error.message : 'Invalid JSON body' },
      { status: 400 }
    );
  }

  try {
    await queryDb(write.text, write.values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving manual data:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
