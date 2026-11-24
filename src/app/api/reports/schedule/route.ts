import { getBeijingDate } from '@/lib/date';
import { recentlyClosedPeriods } from '@/lib/report-period';
import { saveOperationsDraft } from '@/lib/operations-report-store';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const results = [];
  for (const period of recentlyClosedPeriods(getBeijingDate())) {
    try {
      await saveOperationsDraft(period, true);
      results.push({ key: period.key, ok: true });
    } catch (error) {
      console.error('Scheduled operations report:', period.key, error);
      results.push({ key: period.key, ok: false });
    }
  }
  return Response.json({ periods: results }, { status: results.every(r => r.ok) ? 200 : 500 });
}
