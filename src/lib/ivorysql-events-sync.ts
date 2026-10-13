import { load } from 'cheerio';
import { withDbTransaction } from './db';
import type { ActivityMaterialInput } from './material-validation';

export const OFFICIAL_EVENTS_URL = 'https://ivorysql.org/zh/community/events';
const ORIGIN = 'https://ivorysql.org';
const TYPE_MAP: Record<string, string> = { conference: 'conference', summit: 'conference', meetup: 'meetup', webinar: 'webinar', workshop: 'workshop', hackathon: 'hackathon' };
export interface OfficialEvent {
  event_name: string; event_date: string; event_type: string; description: string; location: string; source_url: string;
}
type OfficialMaterial = Omit<ActivityMaterialInput, 'event_id'>;

export function canonicalEventUrl(value: string): string | null {
  try {
    const url = new URL(value, ORIGIN);
    if (!['ivorysql.org', 'www.ivorysql.org'].includes(url.hostname) || !['https:', 'http:'].includes(url.protocol)) return null;
    const slug = url.pathname.match(/^\/(?:zh-cn\/events|zh\/community\/events)\/([a-zA-Z0-9_-]+)\/?$/)?.[1];
    return slug ? `${OFFICIAL_EVENTS_URL}/${slug}` : null;
  } catch { return null; }
}

function httpsUrl(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    let url = new URL(value, base);
    if (url.pathname === '/_next/image' && url.searchParams.has('url')) url = new URL(url.searchParams.get('url')!, base);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}

function parseDate(text: string): string | null {
  const match = text.match(/(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})/);
  if (!match) return null;
  const value = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function parseOfficialEventList(html: string): { events: OfficialEvent[]; nextPage: string | null } {
  const $ = load(html);
  const found = new Map<string, OfficialEvent>();
  $('main a[href]').each((_, node) => {
    const card = $(node);
    const source = canonicalEventUrl(card.attr('href') || '');
    const name = card.find('h2,h3,h4').first().text().trim();
    const date = parseDate(card.text());
    if (!source || !name || !date) return;
    const spans = card.find('span').map((_, span) => $(span).text().trim()).get();
    const type = spans.find(value => TYPE_MAP[value.toLowerCase()]);
    const metadata = card.find('span,div').filter((_, el) => $(el).children('svg').length > 0).map((_, el) => $(el).text().trim()).get();
    const location = metadata.find(value => !parseDate(value) && !['Online', 'Offline', '查看详情'].includes(value)) || '';
    found.set(source, { event_name: name, event_date: date, event_type: TYPE_MAP[type?.toLowerCase() || ''] || 'other', location, description: card.find('p').first().text().trim(), source_url: source });
  });
  if (!found.size) throw new Error('No official events parsed; existing records were not changed');
  const next = $('a[rel="next"]').first().attr('href');
  const nextUrl = httpsUrl(next, OFFICIAL_EVENTS_URL);
  const safeNext = nextUrl && new URL(nextUrl).origin === ORIGIN && new URL(nextUrl).pathname === '/zh/community/events' ? nextUrl : null;
  return { events: [...found.values()], nextPage: safeNext };
}

export function parseOfficialEventDetail(html: string, sourceUrl: string): OfficialMaterial[] {
  const $ = load(html);
  // Streamed Next.js HTML may put the completed article outside the initial main shell.
  const article = $('article').first();
  const body = article.find('.prose').first();
  if (!article.find('h1').length || !body.length) throw new Error(`No official event body: ${sourceUrl}`);
  const materials = new Map<string, OfficialMaterial>();
  function add(material: OfficialMaterial) {
    const key = material.url || `${material.material_type}:${material.access_note}`;
    if (!materials.has(key)) materials.set(key, { ...material, source_url: sourceUrl, sort_order: materials.size });
  }
  // Only the event hero and markdown body are materials, not related-event thumbnails or site logos.
  article.find('img').each((_, node) => {
    if (!$(node).closest('.prose').length && $(node).closest('a').length) return;
    const url = httpsUrl($(node).attr('src'), sourceUrl);
    if (!url || !url.includes('/images/events/')) return;
    const title = $(node).attr('alt')?.trim() || '活动照片';
    add({ material_type: /poster|海报/i.test(`${url} ${title}`) ? 'poster' : 'photo', title, url, thumbnail_url: url });
  });
  body.find('a[href]').each((_, node) => {
    const url = httpsUrl($(node).attr('href'), sourceUrl);
    if (!url) return;
    const title = $(node).text().trim();
    if (!title) return;
    const type = /\.pptx?(?:\?|$)|PPT|幻灯片|slides/i.test(`${url} ${title}`) ? 'ppt'
      : /视频|回放|直播|video|bilibili|youtu/i.test(`${url} ${title}`) ? 'video'
      : /文章|新闻|回顾|报道|mp\.weixin/i.test(`${url} ${title}`) ? 'article' : 'other';
    add({ material_type: type, title, url });
  });
  body.find('p').each((_, node) => {
    const note = $(node).text().trim();
    if (/回复|提取码|领取/.test(note) && /PPT|幻灯片|slides/i.test(note) && !$(node).find('a').length) add({ material_type: 'ppt', title: 'PPT 获取说明', access_note: note });
  });
  return [...materials.values()];
}

export async function persistOfficialEvent(event: OfficialEvent, materials: OfficialMaterial[], transaction: typeof withDbTransaction = withDbTransaction): Promise<number> {
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [event.source_url]);
    const slug = event.source_url.split('/').at(-1)!;
    const existing = await client.query(`SELECT * FROM activity_events
      WHERE source_url = $1 OR (url ~ $2) OR (url IS NULL AND event_name = $3 AND event_date = $4)
      ORDER BY (event_date = $4) DESC, id ASC LIMIT 1 FOR UPDATE`,
    [event.source_url, `^https?://(www\\.)?ivorysql\\.org/(zh-cn/events|zh/community/events)/${slug}/?$`, event.event_name, event.event_date]);
    let id: number;
    let written = 0;
    if (existing.rows.length) {
      const row = existing.rows[0]; id = Number(row.id);
      const updated = await client.query(`UPDATE activity_events SET source_url = $1,
        url = CASE WHEN url IS NULL OR url ~ $2 THEN $1 ELSE url END,
        event_name = $3, event_date = $4, event_type = $5,
        location = COALESCE(NULLIF(location, ''), $6),
        description = COALESCE(NULLIF(description, ''), $7)
        WHERE id = $8 AND (source_url IS DISTINCT FROM $1 OR event_name IS DISTINCT FROM $3
          OR event_date IS DISTINCT FROM $4 OR event_type IS DISTINCT FROM $5 OR url IS NULL
          OR url ~ '^https?://(www\\.)?ivorysql\\.org/zh-cn/events/')`,
      [event.source_url, `^https?://(www\\.)?ivorysql\\.org/(zh-cn/events|zh/community/events)/${slug}/?$`, event.event_name, event.event_date, event.event_type, event.location || null, event.description || null, id]);
      written += updated.rowCount || 0;
    } else {
      const inserted = await client.query(`INSERT INTO activity_events
        (event_name, event_date, event_type, location, description, url, source_url, participants, registrations, online_viewers, collected_data)
        VALUES ($1,$2,$3,$4,$5,$6,$6,0,0,0,'{}') RETURNING id`,
      [event.event_name, event.event_date, event.event_type, event.location || null, event.description || null, event.source_url]);
      id = Number(inserted.rows[0].id); written++;
    }
    for (const material of materials) {
      const result = await client.query(`INSERT INTO activity_materials
        (event_id,material_type,title,url,thumbnail_url,access_note,source_url,sort_order)
        SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE NOT EXISTS (
          SELECT 1 FROM activity_materials WHERE event_id=$1 AND
            (url=$4 OR ($4::text IS NULL AND material_type=$2 AND access_note=$6)))
        ON CONFLICT (event_id,url) WHERE url IS NOT NULL AND url <> '' DO NOTHING`,
      [id, material.material_type, material.title, material.url || null, material.thumbnail_url || null, material.access_note || null, event.source_url, material.sort_order || 0]);
      written += result.rowCount || 0;
    }
    return written;
  });
}

async function fetchOfficialPage(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!res.ok) throw new Error(`Official activity page returned ${res.status}: ${url}`);
  return res.text();
}

export async function syncOfficialEvents(options: {
  fetchPage?: (url: string) => Promise<string>;
  persistEvent?: (event: OfficialEvent, materials: OfficialMaterial[]) => Promise<number>;
} = {}) {
  const fetchPage = options.fetchPage || fetchOfficialPage;
  const persist = options.persistEvent || persistOfficialEvent;
  const events = new Map<string, OfficialEvent>();
  const visited = new Set<string>();
  let next: string | null = OFFICIAL_EVENTS_URL;
  while (next) {
    if (visited.has(next) || visited.size >= 20) throw new Error('Unexpected official activity pagination loop');
    visited.add(next);
    const parsed = parseOfficialEventList(await fetchPage(next));
    for (const event of parsed.events) events.set(event.source_url, event);
    next = parsed.nextPage;
  }
  const prepared: { event: OfficialEvent; materials: OfficialMaterial[] }[] = [];
  const values = [...events.values()];
  for (let index = 0; index < values.length; index += 4) {
    prepared.push(...await Promise.all(values.slice(index, index + 4).map(async event => ({ event, materials: parseOfficialEventDetail(await fetchPage(event.source_url), event.source_url) }))));
  }
  let written = 0;
  for (const { event, materials } of prepared) written += await persist(event, materials);
  return { success: true, events: events.size, recordsSeen: events.size, recordsWritten: written };
}
