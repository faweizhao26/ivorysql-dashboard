import { NextResponse } from 'next/server';
import { eventAccess } from '@/lib/event-access';
import { listWorkspaceEvents } from '@/lib/event-workspace-store';
import { publicEvent } from '@/lib/event-workspace';

export async function GET() {
  try {
    const level = await eventAccess();
    if (!level || level === 'evangelist') return NextResponse.json({ error: '无权访问活动' }, { status: 403 });
    const all = await listWorkspaceEvents();
    return NextResponse.json({ items: level === 'admin' ? all : all.flatMap(e => { const visible = publicEvent(e); return visible ? [visible] : []; }) });
  } catch (error) { console.error('Event workspace read failed:', error); return NextResponse.json({ error: '活动加载失败' }, { status: 500 }); }
}
