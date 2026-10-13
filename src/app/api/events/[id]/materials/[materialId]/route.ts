import { NextResponse } from 'next/server';
import { getActivityEventById } from '@/lib/db';
import {
  deleteActivityMaterial,
  getActivityMaterialById,
  updateActivityMaterial,
  validateMaterialInput,
} from '@/lib/activity-materials';
import { parseEventId } from '../../../route';

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

async function getIds(params: Promise<{ id: string; materialId: string }>) {
  const values = await params;
  return {
    eventId: parseEventId(values.id),
    materialId: parseEventId(values.materialId),
  };
}

async function existingMaterial(eventId: number, materialId: number) {
  const event = await getActivityEventById(eventId);
  if (!event) return { event: null, material: null };
  const material = await getActivityMaterialById(materialId);
  return { event, material: material?.event_id === eventId ? material : null };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  try {
    const { eventId, materialId } = await getIds(params);
    const existing = await existingMaterial(eventId, materialId);
    if (!existing.event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!existing.material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new RangeError('Material input must be an object');
    }
    const input = validateMaterialInput({ ...body, event_id: eventId });
    const material = await updateActivityMaterial(materialId, input);
    return NextResponse.json({ material });
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'Material URL already exists for this event' }, { status: 409 });
    }
    console.error('Error updating event material:', error);
    return NextResponse.json({ error: 'Failed to update material' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  try {
    const { eventId, materialId } = await getIds(params);
    const existing = await existingMaterial(eventId, materialId);
    if (!existing.event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!existing.material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    await deleteActivityMaterial(materialId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting event material:', error);
    return NextResponse.json({ error: 'Failed to delete material' }, { status: 500 });
  }
}
