import { getEvangelistRule } from './evangelist-rules';
import { CONTENT_PLATFORMS } from './content-overview';
import type { ContributorActivityItem } from './contributor-activity';
import type { ReportLine, ReportSources } from './operations-report';

export const platformName = (key: string) => CONTENT_PLATFORMS.find(p => p.key === key)?.name ?? key;

export function reportLink(label: string, raw?: string | null) {
  if (raw) {
    try {
      const url = new URL(raw);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return [{ label, url: url.href }];
    } catch { /* No usable link. */ }
  }
  return [];
}

function articleIdentity(value: string | null) {
  const href = reportLink('', value)[0]?.url;
  if (!href) return null;
  const u = new URL(href);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return u.host.toLowerCase() + u.pathname.replace(/\/$/, '') + u.search;
}

export function publicationDetails(articles: ReportSources['articles'], contributions: ReportSources['contributions'], members: ReportSources['members']) {
  const names = new Map(members.map(m => [m.id, m.name]));
  const byUrl = new Map<string, Set<string>>();
  for (const c of contributions) {
    const path = getEvangelistRule(c.type)?.articlePath;
    if (path !== 'official' && path !== 'postgres') continue;
    const identity = articleIdentity(c.url);
    const name = names.get(c.participant_id);
    if (!identity || !name) continue;
    const authors = byUrl.get(identity) ?? new Set<string>();
    authors.add(name);
    byUrl.set(identity, authors);
  }
  const explicit = /^(?:社区)?布道者(?:投稿|供稿)$/;
  return [...articles].sort((a,b) => b.date.localeCompare(a.date)).map(a => {
    const category = a.content_category?.trim() || '未分类';
    const source = a.content_source?.trim() || '';
    const identity = articleIdentity(a.article_url);
    const authors = identity ? byUrl.get(identity) : undefined;
    const tags = [...new Set([
      category,
      ...(/技术文章|技术日志|技术教程/.test(category) ? ['技术文章'] : []),
      ...(explicit.test(source) || explicit.test(category) || authors?.size ? ['布道者投稿'] : []),
    ])];
    return {
      date: a.date,
      tags,
      text: [a.date, platformName(a.platform), a.article_title, category,
        source && '来源：' + source,
        tags.includes('布道者投稿') && '布道者投稿' + (authors?.size ? '：' + [...authors].join('、') : ''),
        a.views == null ? '阅读量待补录' : '累计阅读 ' + a.views.toLocaleString('zh-CN')].filter(Boolean).join(' · '),
      links: reportLink('原文', a.article_url),
    } satisfies ReportLine & { date: string };
  });
}

export function contributorDetails(items: ContributorActivityItem[], within: (date?: string | null) => boolean) {
  const result: { date: string; row: ReportLine }[] = [];
  for (const item of items) {
    const pr = item.type === 'pr';
    const add = (date: string | undefined, label: string) => {
      if (!date || !within(date)) return;
      result.push({ date, row: {
        tags: [label],
        text: `${date} · ${label} · ${item.author} · #${item.number}${item.title ? ' ' + item.title : ''}`,
        links: reportLink('GitHub', item.url),
      } });
    };
    add(item.created_at, pr ? '提交 PR' : '创建 Issue');
    if (pr && item.status === 'merged') add(item.merged_at, '合并 PR');
  }
  return result.sort((a,b) => b.date.localeCompare(a.date)).map(({ row }) => row);
}
