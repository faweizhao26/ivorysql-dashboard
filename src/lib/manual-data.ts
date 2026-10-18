export type DataCategory = 'social' | 'article' | 'activity';

export const MAX_STATS_VALUE = 2147483647;

export const platforms = {
  social: [
    { value: 'wechat', label: '公众号' },
    { value: 'shipinhao', label: '视频号' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'bilibili', label: 'B站' },
    { value: 'youtube', label: 'YouTube' },
  ],
  article: [
    { value: 'csdn', label: 'CSDN' },
    { value: 'juejin', label: '掘金' },
    { value: 'modb', label: '墨天轮' },
    { value: 'oschina', label: '开源中国' },
    { value: 'sf', label: '思否' },
    { value: 'ctoutiao', label: '51CTO' },
    { value: 'itpub', label: 'ITPUB' },
    { value: 'toutiao', label: '头条号' },
    { value: 'ifclub', label: 'IFCLUB' },
    { value: 'zhihu', label: '知乎' },
    { value: 'cnblogs', label: '博客园' },
    { value: 'wechat', label: '公众号' },
  ],
  activity: [
    { value: 'conference', label: '技术大会' },
    { value: 'meetup', label: '线下活动' },
    { value: 'webinar', label: '线上活动' },
  ],
} as const;

// These values are also the only statistics column names allowed in a manual write.
export const metricsByCategory = {
  social: [
    { value: 'followers', label: '粉丝数' },
    { value: 'posts', label: '发帖数' },
    { value: 'views', label: '阅读/播放量' },
    { value: 'likes', label: '点赞数' },
    { value: 'shares', label: '分享数' },
    { value: 'comments', label: '评论数' },
    { value: 'subscribers', label: '订阅数' },
    { value: 'video_views', label: '视频播放量' },
  ],
  article: [
    { value: 'followers', label: '粉丝数' },
    { value: 'article_count', label: '文章总数' },
    { value: 'total_views', label: '总阅读量' },
    { value: 'avg_views', label: '篇均阅读量' },
    { value: 'new_articles', label: '本月新增文章' },
    { value: 'likes', label: '点赞数' },
    { value: 'bookmarks', label: '收藏数' },
    { value: 'comments', label: '评论数' },
  ],
  activity: [
    { value: 'registrations', label: '报名人数' },
    { value: 'participants', label: '实际参与人数' },
  ],
} as const;

export function isDataCategory(value: unknown): value is DataCategory {
  return value === 'social' || value === 'article' || value === 'activity';
}

export function getManualSelection(category: DataCategory): { category: DataCategory; platform: string; metric: string } {
  return { category, platform: platforms[category][0].value, metric: metricsByCategory[category][0].value };
}

export function buildManualWrite(input: unknown): { text: string; values: unknown[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RangeError('Expected a data entry object');
  }
  const { date, category, platform, metric, value, notes } = input as Record<string, unknown>;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) {
    throw new RangeError('date must be a valid YYYY-MM-DD date');
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new RangeError('date must be a valid YYYY-MM-DD date');
  }
  if (!isDataCategory(category)) throw new RangeError('Unsupported category');
  if (!platforms[category].some(option => option.value === platform)) {
    throw new RangeError('Unsupported platform for category');
  }
  const column = metricsByCategory[category].find(option => option.value === metric)?.value;
  if (!column) throw new RangeError('Unsupported metric for category');
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('value must be a non-negative safe integer');
  }
  if (category !== 'activity' && value > MAX_STATS_VALUE) {
    throw new RangeError(`value must not exceed ${MAX_STATS_VALUE}`);
  }
  if (notes != null && (typeof notes !== 'string' || notes.includes('\0'))) {
    throw new RangeError('notes must be text without NUL characters');
  }

  if (category === 'activity') {
    return {
      text: `INSERT INTO manual_data (date, category, metric, value, notes)
        VALUES ($1, $2, $3, $4, $5)`,
      values: [date, category, `${platform}_${column}`, value, notes || null],
    };
  }

  const table = category === 'social' ? 'social_stats' : 'article_stats';
  return {
    text: `INSERT INTO ${table} (date, platform, ${column})
      VALUES ($1, $2, $3)
      ON CONFLICT (date, platform) DO UPDATE SET
        ${column} = EXCLUDED.${column}, updated_at = CURRENT_TIMESTAMP`,
    values: [date, platform, value],
  };
}
