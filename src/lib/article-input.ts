import type { ArticleDetails } from './db';
import { ARTICLE_PLATFORMS } from './article-query';
import { isArticleDate } from './content-values.mjs';
import { MAX_STATS_VALUE } from './manual-data';

export function parseArticleId(value: unknown): number {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || id > MAX_STATS_VALUE) {
    throw new RangeError('文章 ID 必须是有效的正整数');
  }
  return id;
}

export function parseArticleInput(body: unknown, partial: true): Partial<ArticleDetails>;
export function parseArticleInput(body: unknown, partial?: false): ArticleDetails;
export function parseArticleInput(body: unknown, partial = false): Partial<ArticleDetails> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RangeError('文章数据格式无效');
  const input = body as Record<string, unknown>;
  const article: Partial<ArticleDetails> = {};
  for (const key of ['date', 'platform', 'article_title'] as const) {
    if (partial && input[key] === undefined) continue;
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new RangeError(`${key} 不能为空`);
    article[key] = value.trim();
  }
  if (article.date !== undefined && (!isArticleDate(article.date) || article.date.startsWith('0000'))) {
    throw new RangeError('日期必须是有效的 YYYY-MM-DD 日期');
  }
  if (article.platform !== undefined && !ARTICLE_PLATFORMS.includes(article.platform as typeof ARTICLE_PLATFORMS[number])) {
    throw new RangeError('不支持该文章平台');
  }
  for (const key of ['article_url', 'content_category', 'content_source', 'published_date'] as const) {
    if (input[key] === undefined) continue;
    const value = input[key] === null ? '' : input[key];
    if (typeof value !== 'string' || value.includes('\0')) throw new RangeError(`${key} 必须是文本`);
    article[key] = value.trim();
  }
  if (article.article_url) {
    let url: URL;
    try { url = new URL(article.article_url); } catch { throw new RangeError('文章链接必须是有效的 HTTP 或 HTTPS 链接'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new RangeError('文章链接必须是有效的 HTTP 或 HTTPS 链接');
  }
  if (article.published_date && (!isArticleDate(article.published_date) || article.published_date.startsWith('0000'))) {
    throw new RangeError('发布日期无效');
  }
  for (const key of ['views', 'likes', 'comments'] as const) {
    const value = input[key];
    if (value === undefined || partial && value === null) {
      if (!partial) article[key] = 0;
      continue;
    }
    const count = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_STATS_VALUE) {
      throw new RangeError(`${key} 必须是 0 到 ${MAX_STATS_VALUE} 之间的整数`);
    }
    article[key] = count;
  }
  if (partial && Object.keys(article).length === 0) throw new RangeError('没有需要更新的文章字段');
  return article;
}
