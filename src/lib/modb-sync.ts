import { saveSocialStats, getToday } from '@/lib/db';
import { fetchSyncHtml } from '@/lib/content-sync';

const PLATFORM = 'modb';

export interface ModbUserStats {
  followers: number;
  posts: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  subscribers: number;
  video_views: number;
}

export function parseModbAuthorState(html: string): ModbUserStats | null {
  const totalMatch = html.match(/userTotal:\{([^}]+)\}/);
  if (!totalMatch) return null;
  const totalBody = totalMatch[1];

  const invocation = html.match(/window\.__NUXT__=\(function\(([^)]*)\)\{[\s\S]*?\}\(([^)]*)\)\);/);
  const aliases = new Map<string, number>();
  if (invocation) {
    const names = invocation[1].split(',').map(value => value.trim());
    const values = invocation[2].split(',').map(value => value.trim());
    names.forEach((name, index) => {
      const parsed = Number(values[index]);
      if (Number.isFinite(parsed)) aliases.set(name, parsed);
    });
  }

  function numberField(name: string): number {
    const raw = totalBody.match(new RegExp(`(?:^|,)${name}:([^,}]+)`))?.[1]?.trim();
    if (!raw) return 0;
    const direct = Number(raw);
    return Number.isFinite(direct) ? direct : aliases.get(raw) || 0;
  }

  return {
    followers: numberField('follows'),
    posts: numberField('knowledges') || numberField('contents'),
    views: numberField('totalViews'),
    likes: numberField('likeds'),
    shares: numberField('stars'),
    comments: numberField('commentCount'),
    subscribers: 0,
    video_views: 0,
  };
}

export async function scrapeModb(userId: string = '471017'): Promise<{
  success: boolean;
  stats?: ModbUserStats;
  error?: string;
}> {
  const url = `https://www.modb.pro/u/${userId}`;

  console.log(`Starting 墨天轮 sync for user: ${userId}`);

  try {
    const html = await fetchSyncHtml(url);
    const stats = parseModbAuthorState(html);

    if (!stats) {
      return { success: false, error: 'Could not extract user stats from page' };
    }

    console.log('Extracted stats:', JSON.stringify(stats, null, 2));

    const today = getToday();

    await saveSocialStats({
      date: today,
      platform: PLATFORM,
      followers: stats.followers,
      posts: stats.posts,
      views: stats.views,
      likes: stats.likes,
      shares: stats.shares,
      comments: stats.comments,
      subscribers: stats.subscribers,
      video_views: stats.video_views
    });

    console.log(`墨天轮 sync complete for ${today}`);

    return { success: true, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('墨天轮 sync error:', message);
    return { success: false, error: message };
  }
}
