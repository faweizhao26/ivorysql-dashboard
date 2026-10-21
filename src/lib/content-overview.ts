import type { ArticlePlatformSummary } from './db';
import type { ArticleDateRange } from './article-query';

export const CONTENT_PLATFORMS = [
  { key: 'wechat', name: '公众号' }, { key: 'csdn', name: 'CSDN' },
  { key: 'juejin', name: '掘金' }, { key: 'modb', name: '墨天轮' },
  { key: 'oschina', name: '开源中国' }, { key: 'sf', name: '思否' },
  { key: 'ctoutiao', name: '51CTO' }, { key: 'itpub', name: 'ITPUB' },
  { key: 'toutiao', name: '头条号' }, { key: 'cnblogs', name: '博客园' },
  { key: 'zhihu', name: '知乎' },
] as const;

export type ContentPlatformKey = typeof CONTENT_PLATFORMS[number]['key'];
export interface ContentOverview {
  platforms: ArticlePlatformSummary[];
  updated_at: string | null;
}

export function resolveContentPlatform(value: string | null): ContentPlatformKey {
  return CONTENT_PLATFORMS.find(platform => platform.key === value)?.key ?? 'wechat';
}

export function contentDateQuery(range?: ArticleDateRange) {
  return new URLSearchParams(range ? { start: range.start, end: range.end } : {});
}

export async function fetchContentOverview(signal?: AbortSignal, fetcher: typeof fetch = fetch, range?: ArticleDateRange): Promise<ContentOverview> {
  const query = contentDateQuery(range).toString();
  const response = await fetcher(`/api/content${query ? `?${query}` : ''}`, { credentials: 'include', cache: 'no-store', signal });
  if (!response.ok) throw new Error('平台汇总加载失败，请重试');
  const result = await response.json();
  if (!Array.isArray(result.platforms) || result.platforms.some((row: ArticlePlatformSummary) =>
    !row || typeof row.platform !== 'string' || !Number.isFinite(row.article_count) || !Number.isFinite(row.total_views))) {
    throw new Error('平台汇总数据格式无效，请重试');
  }
  return { platforms: result.platforms, updated_at: result.updated_at ?? null };
}

export function contentOverviewExportRows(summaries: ArticlePlatformSummary[], range?: ArticleDateRange) {
  const byPlatform = new Map(summaries.map(summary => [summary.platform, summary]));
  return CONTENT_PLATFORMS.flatMap(({ key, name }) => {
    const summary = byPlatform.get(key);
    return summary ? [{ 指标: '内容平台', 平台: name, 文章数: summary.article_count, 阅读量: summary.total_views, 统计口径: range ? '按发布日期 · 当前累计阅读' : '最新累计', 时间段: range ? `${range.start} ~ ${range.end}` : '全部日期', 数据更新: summary.updated_at || '' }] : [];
  });
}
