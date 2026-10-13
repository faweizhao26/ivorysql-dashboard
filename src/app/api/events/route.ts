import { NextResponse } from 'next/server';
import { 
  getPagedActivityEvents,
  saveActivityEvent, 
  updateActivityEvent, 
  deleteActivityEvent
} from '@/lib/db';

const EVENT_TYPES = new Set(['conference', 'meetup', 'webinar', 'workshop', 'hackathon', 'other']);

export function parseEventId(value: string): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) throw new RangeError('Invalid event id');
  return id;
}

export function parseEventListParams(searchParams: URLSearchParams) {
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '100');
  const year = searchParams.get('year')?.trim() || undefined;
  const type = searchParams.get('type')?.trim() || undefined;
  const search = searchParams.get('search')?.trim().slice(0, 100) || undefined;

  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new RangeError('Invalid page');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError('Invalid pageSize; expected 1 to 100');
  }
  if (year && !/^\d{4}$/.test(year)) throw new RangeError('Invalid year');
  if (type && !EVENT_TYPES.has(type)) throw new RangeError('Invalid event type');
  return { page, pageSize, year, type, search };
}

export async function GET(request: Request) {
  try {
    const params = parseEventListParams(new URL(request.url).searchParams);
    const result = await getPagedActivityEvents(params);
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
    const body = await request.json();
    const { event_name, event_date, event_type, location, venue, participants, registrations, online_viewers, collected_data, description, url } = body;

    if (!event_name || !event_date || !event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await saveActivityEvent({
      event_name,
      event_date,
      event_type,
      location,
      venue,
      participants: participants || 0,
      registrations: registrations || 0,
      online_viewers: online_viewers || 0,
      collected_data: collected_data || {},
      description,
      url
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving activity event:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, event_name, event_date, event_type, location, venue, participants, registrations, online_viewers, collected_data, description, url } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    await updateActivityEvent(id, {
      event_name,
      event_date,
      event_type,
      location,
      venue,
      participants,
      registrations,
      online_viewers,
      collected_data,
      description,
      url
    });

    return NextResponse.json({ success: true });
  } catch (error) {
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
