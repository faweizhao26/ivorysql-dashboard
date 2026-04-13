import { saveSocialStats, getToday } from '@/lib/db';

const PLATFORM = 'modb';

interface ModbUserStats {
  followers: number;
  posts: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  subscribers: number;
  video_views: number;
}

function extractUserStats(html: string): ModbUserStats | null {
  const nuxtMatch = html.match(/window\.__NUXT__=\(([\s\S]+?)\);<\/script>/);
  if (!nuxtMatch) return null;

  try {
    const nuxtData = eval('(' + nuxtMatch[0].replace('window.__NUXT__=', '').replace(/;<\/script>/, '') + ')');
    const userTotal = nuxtData?.data?.[0]?.userTotal;
    if (!userTotal) return null;

    return {
      followers: userTotal.follows || 0,
      posts: userTotal.knowledges || 0,
      views: userTotal.totalViews || 0,
      likes: userTotal.likeds || 0,
      shares: userTotal.stars || 0,
      comments: userTotal.commentCount || 0,
      subscribers: 0,
      video_views: 0
    };
  } catch (e) {
    console.error('Error parsing NUXT data:', e);
    return null;
  }
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });
  return res.text();
}

export async function scrapeModb(userId: string = '471017'): Promise<{
  success: boolean;
  stats?: ModbUserStats;
  error?: string;
}> {
  const url = `https://www.modb.pro/u/${userId}`;

  console.log(`Starting 墨天轮 sync for user: ${userId}`);

  try {
    const html = await fetchPage(url);
    const stats = extractUserStats(html);

    if (!stats) {
      return { success: false, error: 'Could not extract user stats from page' };
    }

    console.log('Extracted stats:', JSON.stringify(stats, null, 2));

    const today = getToday();

    saveSocialStats({
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
  } catch (error: any) {
    console.error('墨天轮 sync error:', error);
    return { success: false, error: error.message };
  }
}