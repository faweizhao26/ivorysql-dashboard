import { NextResponse } from 'next/server';
import { getActivityEventById, getActivityMaterialCounts } from '@/lib/db';
import { listActivityMaterials } from '@/lib/activity-materials';
import { parseEventId } from '@/lib/event-query';
import { eventAccess } from '@/lib/event-access';
import { publicEvent } from '@/lib/event-workspace';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseEventId((await params).id);
    const raw = await getActivityEventById(id);
    const event = raw && (await eventAccess() === 'admin' ? raw : publicEvent(raw));
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const [materials, materialCounts] = await Promise.all([
      listActivityMaterials(id),
      getActivityMaterialCounts(id),
    ]);
    return NextResponse.json({ event, materials, material_counts: materialCounts });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching event detail:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
