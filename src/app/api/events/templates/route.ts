import { NextResponse } from 'next/server';
import { eventAccess } from '@/lib/event-access';
import { getTaskTemplates, saveTaskTemplate } from '@/lib/event-workspace-store';

export async function GET() {
  if (await eventAccess() !== 'admin') return NextResponse.json({ error: '仅管理员可访问任务模板' }, { status: 403 });
  try { return NextResponse.json({ templates: await getTaskTemplates() }); }
  catch (error) { console.error(error); return NextResponse.json({ error: '任务模板加载失败' }, { status: 500 }); }
}
export async function PUT(request: Request) {
  if (await eventAccess() !== 'admin') return NextResponse.json({ error: '仅管理员可编辑任务模板' }, { status: 403 });
  try { const body = await request.json(); await saveTaskTemplate(body.key, body.tasks); return NextResponse.json({ success: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof RangeError ? error.message : '任务模板保存失败' }, { status: error instanceof RangeError || error instanceof SyntaxError ? 400 : 500 }); }
}
