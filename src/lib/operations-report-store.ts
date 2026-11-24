import { randomUUID } from 'node:crypto';
import { queryDb, withDbTransaction } from './db';
import { shiftDate } from './date';
import { buildOperationsReport, type ReportDocument, type ReportSources } from './operations-report';
import { compareReportPeriod, type ReportPeriod } from './report-period';

export interface StoredReport { document: ReportDocument; revision: string | null; finalized_at: string | null }

export async function generateOperationsReport(period: ReportPeriod) {
  const generatedAt = new Date().toISOString();
  const sources = await withDbTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data = async (sql: string, params?: unknown[]) => (await client.query(sql, params)).rows;
    const boundary = shiftDate(period.start, -1);
    const bounds = [boundary, period.end];
    const articles = await data(`SELECT platform, article_title, article_url, views, content_category, content_source,
      COALESCE(NULLIF(published_date, ''), date) AS date FROM article_details
      WHERE COALESCE(NULLIF(published_date, ''), date) BETWEEN $1 AND $2
      ORDER BY platform, views DESC NULLS LAST, id`, [compareReportPeriod(period).prior.start, period.end]);
    const github = await data(`SELECT date, main_repo_monthly_activity AS months FROM contributor_stats
      WHERE jsonb_typeof(main_repo_monthly_activity) = 'array' AND main_repo_monthly_activity <> '[]'::jsonb
      ORDER BY date DESC LIMIT 1`);
    const snapshots = await data(`WITH bounds AS (SELECT unnest($1::text[]) AS cutoff)
      SELECT cutoff, 'github' AS source, '' AS platform, g.date, g.stars AS first, g.forks AS second
        FROM bounds CROSS JOIN LATERAL (SELECT date, stars, forks FROM github_stats WHERE date <= cutoff ORDER BY date DESC LIMIT 1) g
      UNION ALL
      SELECT cutoff, 'social', s.platform, s.date, s.followers, NULL
        FROM bounds CROSS JOIN LATERAL (SELECT DISTINCT ON (platform) platform, date, followers FROM social_stats WHERE date <= cutoff ORDER BY platform, date DESC) s
      UNION ALL
      SELECT cutoff, 'downloads', '', d.date, d.github_total, d.docker_total
        FROM bounds CROSS JOIN LATERAL (SELECT date, github_total, docker_total FROM download_stats WHERE date <= cutoff ORDER BY date DESC LIMIT 1) d
      ORDER BY source, platform, cutoff`, [bounds]);
    const counter = (label: string, source: string, field: 'first' | 'second', platform = '') => {
      const read = (cutoff: string) => {
        const row = snapshots.find(r => r.cutoff === cutoff && r.source === source && r.platform === platform);
        return row ? { date: row.date as string, value: row[field] == null ? null : Number(row[field]) } : null;
      };
      return { label, start: read(boundary), end: read(period.end) };
    };
    const socialLabels: Record<string, string> = { wechat: '公众号', twitter: 'X', linkedin: 'LinkedIn', youtube: 'YouTube', bilibili: 'B 站' };
    const social = [...new Set<string>(snapshots.filter(r => r.source === 'social').map(r => r.platform))];
    const counters = [counter('Stars','github','first'), counter('Forks','github','second'),
      ...social.map(p => counter((socialLabels[p] ?? p) + ' 粉丝','social','first',p)),
      counter('GitHub Release 下载','downloads','first'), counter('Docker Hub 拉取','downloads','second')];
    const activities = await data('SELECT id, event_name, event_date, event_type, location, participants, registrations, online_viewers, collected_data FROM activity_events ORDER BY event_date, id');
    const materials = await data("SELECT event_id, title, url FROM activity_materials WHERE url IS NOT NULL ORDER BY event_id, sort_order, id");
    const members = await data('SELECT id, name FROM evangelist_participants ORDER BY name, id');
    const contributions = await data('SELECT participant_id, date, category, type, title, url, COALESCE(points, 0) AS points FROM evangelist_contributions ORDER BY date, id');
    return { articles, github: github[0] ?? null, counters, activities, materials, members, contributions } as ReportSources;
  });
  return buildOperationsReport(period, sources, generatedAt);
}

export async function getOperationsReport(p: ReportPeriod): Promise<StoredReport | null> {
  return (await queryDb('SELECT document, revision, finalized_at FROM operations_reports WHERE kind=$1 AND period_key=$2', [p.kind, p.key])).rows[0] ?? null;
}

export async function saveOperationsDraft(p: ReportPeriod, automatic = false): Promise<StoredReport> {
  const prior = await getOperationsReport(p);
  if (prior?.finalized_at || (automatic && prior?.document.period.closed)) return prior;
  const report = await generateOperationsReport(p);
  const result = await queryDb(`INSERT INTO operations_reports AS existing (kind,period_key,revision,document)
    VALUES($1,$2,$3,$4::jsonb) ON CONFLICT (kind,period_key) DO UPDATE
    SET revision=EXCLUDED.revision, document=EXCLUDED.document
    WHERE existing.finalized_at IS NULL AND
    (NOT $5::boolean OR (existing.document->'period'->>'closed') IS DISTINCT FROM 'true')
    RETURNING document, revision, finalized_at`, [p.kind,p.key,randomUUID(),JSON.stringify(report),automatic]);
  return result.rows[0] ?? (await getOperationsReport(p))!;
}

export async function finalizeOperationsDraft(p: ReportPeriod, revision: string): Promise<StoredReport | null> {
  return (await queryDb(`UPDATE operations_reports SET finalized_at=now()
    WHERE kind=$1 AND period_key=$2 AND revision=$3::uuid AND finalized_at IS NULL
    RETURNING document, revision, finalized_at`, [p.kind,p.key,revision])).rows[0] ?? null;
}
