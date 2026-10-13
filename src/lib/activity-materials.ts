import { queryDb } from './db';

export const ACTIVITY_MATERIAL_TYPES = ['photo', 'poster', 'ppt', 'video', 'article', 'other'] as const;
export type ActivityMaterialType = typeof ACTIVITY_MATERIAL_TYPES[number];

export interface ActivityMaterial {
  id: number;
  event_id: number;
  material_type: ActivityMaterialType;
  title: string;
  url: string | null;
  thumbnail_url: string | null;
  access_note: string | null;
  source_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityMaterialInput {
  event_id: number;
  material_type: ActivityMaterialType;
  title: string;
  url?: string | null;
  thumbnail_url?: string | null;
  access_note?: string | null;
  source_url?: string | null;
  sort_order?: number;
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function httpsUrl(value: string | null | undefined, field: string): string | null {
  const normalized = optionalText(value);
  if (!normalized) return null;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new RangeError(`${field} must be a valid https URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new RangeError(`${field} must use https`);
  }
  return parsed.toString();
}

export function validateMaterialInput(input: ActivityMaterialInput): Required<ActivityMaterialInput> {
  if (!Number.isInteger(input.event_id) || input.event_id <= 0) {
    throw new RangeError('event_id must be a positive integer');
  }
  if (!ACTIVITY_MATERIAL_TYPES.includes(input.material_type)) {
    throw new RangeError('Unsupported material type');
  }
  const title = input.title?.trim();
  if (!title) throw new RangeError('title is required');

  const url = httpsUrl(input.url, 'url');
  const accessNote = optionalText(input.access_note);
  if (!url && !accessNote) {
    throw new RangeError('A https URL or access note is required');
  }

  const sortOrder = input.sort_order ?? 0;
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new RangeError('sort_order must be a non-negative integer');
  }

  return {
    event_id: input.event_id,
    material_type: input.material_type,
    title,
    url,
    thumbnail_url: httpsUrl(input.thumbnail_url, 'thumbnail_url'),
    access_note: accessNote,
    source_url: httpsUrl(input.source_url, 'source_url'),
    sort_order: sortOrder,
  };
}

function mapMaterial(row: Record<string, unknown>): ActivityMaterial {
  return {
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
    sort_order: Number(row.sort_order),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  } as ActivityMaterial;
}

export async function listActivityMaterials(eventId: number): Promise<ActivityMaterial[]> {
  if (!Number.isInteger(eventId) || eventId <= 0) throw new RangeError('Invalid event id');
  const result = await queryDb(
    'SELECT * FROM activity_materials WHERE event_id = $1 ORDER BY sort_order ASC, id ASC',
    [eventId],
  );
  return result.rows.map(mapMaterial);
}

export async function saveActivityMaterial(input: ActivityMaterialInput): Promise<ActivityMaterial> {
  const value = validateMaterialInput(input);
  const result = await queryDb(
    `INSERT INTO activity_materials
       (event_id, material_type, title, url, thumbnail_url, access_note, source_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id, url) WHERE url IS NOT NULL AND url <> ''
     DO UPDATE SET
       material_type = EXCLUDED.material_type,
       title = EXCLUDED.title,
       thumbnail_url = EXCLUDED.thumbnail_url,
       access_note = EXCLUDED.access_note,
       source_url = EXCLUDED.source_url,
       sort_order = EXCLUDED.sort_order,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [value.event_id, value.material_type, value.title, value.url, value.thumbnail_url, value.access_note, value.source_url, value.sort_order],
  );
  return mapMaterial(result.rows[0]);
}

export async function updateActivityMaterial(id: number, input: ActivityMaterialInput): Promise<ActivityMaterial | null> {
  if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid material id');
  const value = validateMaterialInput(input);
  const result = await queryDb(
    `UPDATE activity_materials SET
       event_id = $1, material_type = $2, title = $3, url = $4,
       thumbnail_url = $5, access_note = $6, source_url = $7,
       sort_order = $8, updated_at = CURRENT_TIMESTAMP
     WHERE id = $9
     RETURNING *`,
    [value.event_id, value.material_type, value.title, value.url, value.thumbnail_url, value.access_note, value.source_url, value.sort_order, id],
  );
  return result.rows[0] ? mapMaterial(result.rows[0]) : null;
}

export async function deleteActivityMaterial(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) throw new RangeError('Invalid material id');
  const result = await queryDb('DELETE FROM activity_materials WHERE id = $1', [id]);
  return (result.rowCount || 0) > 0;
}
