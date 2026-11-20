import { NextResponse } from 'next/server';
import { 
  getPagedActivityEvents,
  deleteActivityEvent
} from '@/lib/db';
import { eventAccess } from '@/lib/event-access';
import { publicEvent } from '@/lib/event-workspace';
import { EventConflict, EventNotFound, writeWorkspaceEvent } from '@/lib/event-workspace-store';
import { parseEventId, parseEventListParams } from '@/lib/event-query';

export async function GET(request: Request) {
  try {
    const params = parseEventListParams(new URL(request.url).searchParams);
    const admin = await eventAccess() === 'admin';
    const result = await getPagedActivityEvents({ ...params, includeInternal: admin });
    if (!admin) result.items = result.items.flatMap(item => { const visible = publicEvent(item); return visible ? [visible] : []; });
    return NextResponse.json({
      ...result,
      page: params.page,
      pageSize: params.pageSize,
      events: result.items,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching activity events:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (await eventAccess() !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RangeError('活动数据格式错误');
    const eventId = await writeWorkspaceEvent(body);
    return NextResponse.json({ success: true, eventId });
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error saving activity event:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (await eventAccess() !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RangeError('活动数据格式错误');
    await writeWorkspaceEvent(body, parseEventId(String(body.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof EventConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof EventNotFound) return NextResponse.json({ error: error.message }, { status: 404 });
    console.error('Error updating activity event:', error);
    return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    await deleteActivityEvent(parseEventId(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting activity event:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
