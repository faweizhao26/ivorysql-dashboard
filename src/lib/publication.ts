import { CONTENT_PLATFORMS } from './content-overview';
import { isArticleDate } from './content-values.mjs';
import { parseArticleId, parseArticleInput } from './article-input';

export const publicationChannels = CONTENT_PLATFORMS.filter(p => p.key !== 'juejin');
export interface PublicationPlan { id: number; title: string; planned_date: string | null; channels: string[] }

export function parsePlan(input: Record<string, unknown>): Omit<PublicationPlan, 'id'> {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const date = input.planned_date;
  if (!title || title.length > 200 || title.includes('\0')) throw new RangeError('请填写 200 字以内的标题');
  if (date != null && date !== '' && (typeof date !== 'string' || !isArticleDate(date) || date.startsWith('0000'))) throw new RangeError('计划日期无效');
  if (!Array.isArray(input.channels) || !input.channels.length || !input.channels.every(k => publicationChannels.some(p => p.key === k))) throw new RangeError('请选择有效的计划渠道');
  return { title, planned_date: typeof date === 'string' && date ? date : null, channels: [...new Set<string>(input.channels)] };
}

export function parsePublication(input: Record<string, unknown>, today: string) {
  const a = parseArticleInput({ platform: input.platform, article_title: input.title, date: input.date, article_url: input.url });
  if (!a.article_url || !publicationChannels.some(p => p.key === a.platform)) throw new RangeError('请填写发布渠道和文章链接');
  if (a.date > today) throw new RangeError('实际发布日期不能晚于今天');
  return { title: a.article_title, date: a.date, platform: a.platform, url: a.article_url, planId: input.planId == null ? null : parseArticleId(input.planId) };
}
