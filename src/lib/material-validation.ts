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
  if (value != null && typeof value !== 'string') throw new RangeError('Text fields must be strings');
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
  const title = optionalText(input.title);
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
