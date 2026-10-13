export const EVENT_TYPES = [
  { value: 'conference', label: '技术大会' }, { value: 'meetup', label: '线下聚会' },
  { value: 'webinar', label: '线上直播' }, { value: 'workshop', label: '工作坊' },
  { value: 'hackathon', label: '黑客马拉松' }, { value: 'other', label: '其他' },
];
export const MATERIAL_LABELS: Record<string, string> = {
  poster: '海报', photo: '照片', ppt: 'PPT', video: '视频', article: '文章', other: '其他资料',
};
export interface EventFiltersValue { year: string; type: string; search: string }
export function buildEventQuery(filters: EventFiltersValue, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: '12' });
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
  return params;
}
export function describeMaterials(counts: Record<string, number>) {
  return Object.entries(MATERIAL_LABELS).filter(([key]) => counts[key] > 0)
    .map(([key, label]) => `${label} ${counts[key]}`).join(' · ') || '暂无资料';
}
