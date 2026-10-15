import { load } from 'cheerio';
import type { SyncedArticle } from './content-sync';
import { normalizeMetric, parseArticleDate } from './content-values.mjs';

export function parseCSDNArticles(html: string): SyncedArticle[] {
  const $ = load(html);
  const articles: SyncedArticle[] = [];
  $('article.blog-list-box').each((_, element) => {
    const card = $(element);
    const title = card.find('h4').text().trim();
    const url = card.find('a[href*="/article/details/"]').first().attr('href');
    if (!title || !url) return;
    const dateLabel = card.text().match(/博文更新于\s*([^·\n]+)/)?.[1];
    articles.push({
      title, url,
      date: parseArticleDate(dateLabel) || '',
      views: normalizeMetric(card.find('.view-num').text()),
      likes: normalizeMetric(card.find('.give-like-num').text()),
      comments: normalizeMetric(card.find('.comment-num').text()),
    });
  });
  return articles;
}

export function parseCnblogsArticles(html: string): SyncedArticle[] {
  const $ = load(html);
  const articles: SyncedArticle[] = [];
  $('.day').each((_, element) => {
    const day = $(element);
    const dayDate = parseArticleDate(day.find('.dayTitle').text());
    day.find('a.postTitle2').each((_, anchor) => {
      const link = $(anchor);
      const title = link.text().trim();
      const url = link.attr('href');
      if (!title || !url) return;
      const siblings = link.closest('.postTitle').nextUntil('.postTitle');
      const description = siblings.filter('.postDesc').add(siblings.find('.postDesc')).first();
      const dateLabel = description.text().match(/posted\s*@\s*(\d{4}-\d{2}-\d{2})/)?.[1];
      articles.push({
        title, url,
        date: parseArticleDate(dateLabel, dayDate) || '',
        views: normalizeMetric(description.find('.post-view-count').text()),
      });
    });
  });
  return articles;
}
