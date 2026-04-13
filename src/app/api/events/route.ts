import { NextResponse } from 'next/server';
import { 
  getActivityEvents, 
  getAllActivityEvents, 
  saveActivityEvent, 
  updateActivityEvent, 
  deleteActivityEvent,
  getActivityEventById
} from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '365', 10);

  try {
    const events = days > 0 ? await getActivityEvents(days) : await getAllActivityEvents();
    return NextResponse.json({ events });
  } catch (error) {
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

    await deleteActivityEvent(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity event:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}