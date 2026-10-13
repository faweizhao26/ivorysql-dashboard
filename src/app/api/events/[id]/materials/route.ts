import { NextResponse } from 'next/server';
import { getActivityEventById } from '@/lib/db';
import { saveActivityMaterial, validateMaterialInput } from '@/lib/activity-materials';
import { parseEventId } from '../../route';

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const eventId = parseEventId((await params).id);
    const event = await getActivityEventById(eventId);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new RangeError('Material input must be an object');
    }
    const input = validateMaterialInput({ ...body, event_id: eventId });
    const material = await saveActivityMaterial(input);
    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'Material URL already exists for this event' }, { status: 409 });
    }
    console.error('Error saving event material:', error);
    return NextResponse.json({ error: 'Failed to save material' }, { status: 500 });
  }
}
