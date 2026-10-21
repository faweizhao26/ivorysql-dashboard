import { isArticleDate } from './content-values.mjs';

export const ARTICLE_PLATFORMS = [
  'wechat', 'csdn', 'juejin', 'modb', 'oschina', 'sf', 'ctoutiao',
  'itpub', 'toutiao', 'ifclub', 'zhihu', 'cnblogs',
] as const;

export interface ArticleListParams {
  platform: string;
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  range?: ArticleDateRange;
}

export interface ArticleDateRange {
  start: string;
  end: string;
}

export function parseArticleDateRange(searchParams: Pick<URLSearchParams, 'get' | 'has'>): ArticleDateRange | undefined {
  if (!searchParams.has('start') && !searchParams.has('end')) return undefined;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  if (!isArticleDate(start) || !isArticleDate(end)) throw new RangeError('Invalid date; expected start and end as YYYY-MM-DD');
  if (start > end) throw new RangeError('start must be before or equal to end');
  return { start, end };
}

export function parseArticleListParams(searchParams: URLSearchParams): ArticleListParams {
  const platform = searchParams.get('platform') || '';
  if (!ARTICLE_PLATFORMS.includes(platform as typeof ARTICLE_PLATFORMS[number])) {
    throw new RangeError('Invalid or missing platform');
  }
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '10');
  if (!Number.isInteger(page) || page < 1) throw new RangeError('Invalid page');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError('Invalid pageSize; expected 1 to 100');
  }
  const search = searchParams.get('search')?.trim().slice(0, 100) || undefined;
  const category = searchParams.get('category')?.trim().slice(0, 100) || undefined;
  const range = parseArticleDateRange(searchParams);
  return { platform, page, pageSize, search, category, ...(range ? { range } : {}) };
}
