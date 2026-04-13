import {
  saveGitHubStats,
  saveContributorStats,
  saveSocialStats,
  saveArticleStats,
  saveWebsiteStats,
  saveCommunityEvent,
  getToday
} from './db';

function generateDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

export function seedSampleData() {
  console.log('Seeding sample data...');

  const dates = generateDates(30);
  let stars = 2850;
  let forks = 520;
  let watchers = 340;
  let contributors = 45;
  let cumulative2026 = 0;

  const socialPlatforms = ['wechat', 'twitter', 'bilibili', 'youtube'];
  const articlePlatforms = ['csdn', 'juejin', 'modb', 'oschina', 'sf', 'ctoutiao', 'itpub', 'toutiao', 'ifclub'];

  const socialData: Record<string, { followers: number; views: number }> = {
    wechat: { followers: 12500, views: 45000 },
    twitter: { followers: 5200, views: 15000 },
    bilibili: { followers: 3500, views: 85000 },
    youtube: { followers: 2800, views: 120000 },
  };

  const articleData: Record<string, { articles: number; views: number; followers: number }> = {
    csdn: { articles: 45, views: 125000, followers: 8500 },
    juejin: { articles: 32, views: 89000, followers: 5200 },
    modb: { articles: 18, views: 45000, followers: 2800 },
    oschina: { articles: 25, views: 68000, followers: 4200 },
    sf: { articles: 15, views: 35000, followers: 1800 },
    ctoutiao: { articles: 22, views: 55000, followers: 3200 },
    itpub: { articles: 12, views: 28000, followers: 1500 },
    toutiao: { articles: 28, views: 72000, followers: 4800 },
    ifclub: { articles: 8, views: 18000, followers: 950 },
  };

  dates.forEach((date, index) => {
    stars += Math.floor(Math.random() * 15) - 3;
    forks += Math.floor(Math.random() * 5) - 1;
    watchers += Math.floor(Math.random() * 3);
    contributors += Math.random() > 0.8 ? 1 : 0;

    const dailyNew = Math.floor(Math.random() * 3);
    cumulative2026 += dailyNew;

    saveGitHubStats({
      date,
      stars: Math.max(stars, 2850),
      forks: Math.max(forks, 520),
      watchers: Math.max(watchers, 340),
      subscribers: 280,
      open_issues: 45 + Math.floor(Math.random() * 20),
      open_prs: 12 + Math.floor(Math.random() * 10),
      contributors: Math.max(contributors, 45),
      releases_count: 28
    });

    saveContributorStats({
      date,
      total_contributors: 1280 + cumulative2026,
      contributors_before_2026: 1280,
      new_contributors_daily: dailyNew,
      new_contributors_weekly: Math.floor(Math.random() * 10) + 3,
      new_contributors_monthly: Math.floor(Math.random() * 30) + 10,
      new_contributors_quarterly: Math.floor(Math.random() * 80) + 30,
      cumulative_2026: cumulative2026
    });

    socialPlatforms.forEach(platform => {
      const data = socialData[platform];
      data.followers += Math.floor(Math.random() * 20) - 5;
      data.views += Math.floor(Math.random() * 500) - 100;

      saveSocialStats({
        date,
        platform,
        followers: Math.max(data.followers, 0),
        posts: platform === 'bilibili' ? 5 + Math.floor(Math.random() * 10) : 20 + Math.floor(Math.random() * 30),
        views: Math.max(data.views, 0),
        likes: Math.floor(Math.random() * 500) + 100,
        shares: Math.floor(Math.random() * 100) + 20,
        comments: Math.floor(Math.random() * 200) + 50,
        subscribers: platform === 'bilibili' ? data.followers : 0,
        video_views: platform === 'youtube' || platform === 'bilibili' ? data.views : 0,
      });
    });

    articlePlatforms.forEach(platform => {
      const data = articleData[platform];
      data.articles += Math.floor(Math.random() * 2);
      data.views += Math.floor(Math.random() * 2000) - 300;

      saveArticleStats({
        date,
        platform,
        article_count: Math.max(data.articles, 0),
        total_views: Math.max(data.views, 0),
        avg_views: Math.floor(data.views / Math.max(data.articles, 1)),
        likes: Math.floor(Math.random() * 500) + 100,
        bookmarks: Math.floor(Math.random() * 300) + 50,
        comments: Math.floor(Math.random() * 150) + 30,
        followers: Math.max(data.followers, 0),
        new_articles: Math.floor(Math.random() * 3)
      });
    });

    saveWebsiteStats({
      date,
      pageviews: 12000 + Math.floor(Math.random() * 5000),
      unique_visitors: 4000 + Math.floor(Math.random() * 2000),
      top_pages: [
        '/zh-cn/',
        '/zh-cn/docs-installation',
        '/zh-cn/releases-page',
        '/zh-cn/blog',
        '/zh-cn/community-page'
      ],
      sources: ['Google:35', 'Direct:25', 'Baidu:20', 'GitHub:12', 'Other:8'],
      keywords: ['IvorySQL', 'PostgreSQL', 'Oracle兼容', '数据库迁移', '开源数据库']
    });
  });

  const sampleEvents = [
    { source: 'GitHub Issue', title: '#1234: 修复 PL/SQL 兼容性问题', url: 'https://github.com/IvorySQL/IvorySQL/issues/1234', event_type: 'github_issue' },
    { source: 'GitHub PR', title: '#567: 添加新函数 support', url: 'https://github.com/IvorySQL/IvorySQL/pull/567', event_type: 'github_pr' },
    { source: 'GitHub Release', title: 'IvorySQL 5.3 正式发布', url: 'https://github.com/IvorySQL/IvorySQL/releases/tag/v5.3', event_type: 'release' },
    { source: '公众号', title: '《IvorySQL 5.3 新特性详解》发布', url: '#', event_type: 'blog' },
    { source: 'CSDN', title: '《Oracle 到 IvorySQL 迁移实战》发布', url: '#', event_type: 'blog' },
    { source: '博客', title: 'PGConf.Asia 2024 精彩回顾', url: 'https://www.ivorysql.org/blog', event_type: 'blog' },
    { source: '活动', title: 'IvorySQL 技术Meetup 圆满结束', url: '#', event_type: 'event' }
  ];

  dates.forEach((date, index) => {
    if (index % 2 === 0) {
      const event = sampleEvents[index % sampleEvents.length];
      saveCommunityEvent({
        date,
        source: event.source,
        title: event.title,
        description: '社区成员积极参与讨论和贡献',
        url: event.url,
        event_type: event.event_type
      });
    }
  });

  console.log('Sample data seeded successfully!');
  console.log(`  - ${dates.length} days of GitHub stats`);
  console.log(`  - ${dates.length} days of contributor stats`);
  console.log(`  - ${dates.length} days × ${socialPlatforms.length} social platforms`);
  console.log(`  - ${dates.length} days × ${articlePlatforms.length} article platforms`);
  console.log(`  - ${dates.length} days of website stats`);
  console.log(`  - ${Math.floor(dates.length / 2)} community events`);
}

if (require.main === module) {
  seedSampleData();
}
