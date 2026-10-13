import { NextResponse } from 'next/server';
import { syncOfficialEvents } from '@/lib/ivorysql-events-sync';
import { runTrackedSync } from '@/lib/tracked-sync';

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const result = await runTrackedSync({ platform: 'events', trigger: request.method === 'GET' ? 'vercel_cron' : 'manual' }, async () => {
      const value = await syncOfficialEvents();
      return { value, recordsSeen: value.recordsSeen, recordsWritten: value.recordsWritten };
    });
    return NextResponse.json({ ...result.value, runId: result.runId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Official activity sync failed' }, { status: 502 });
  }
}
export async function GET(request: Request) { return POST(request); }
