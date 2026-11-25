import { getDb, type DownloadStatsHistory } from '@/lib/db';
import { getBeijingDate, shiftDate } from '@/lib/date';

export async function GET() {
  try {
    const today = getBeijingDate();
    // The shared query helper runs schema initialization; history must stay read-only.
    const { rows } = await getDb().query<DownloadStatsHistory>(
      `SELECT date, github_total, docker_total FROM download_stats
       WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
      [shiftDate(today, -364), today],
    );
    return Response.json({ downloads: rows });
  } catch (error) {
    console.error('Download history error:', error);
    return Response.json({ error: '下载历史暂时不可用' }, { status: 500 });
  }
}
