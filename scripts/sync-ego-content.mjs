const fs = await import('node:fs/promises');
const path = await import('node:path');

const DASHBOARD_BASE = 'https://ivorysql-dashboard.vercel.app';
const PROJECT_DIR = '/Users/felixzhao/ivorysql-dashboard';
const OSCHINA_USER_ID = '5729420';
const CTO_USER_ID = '17240866';
const TOUTIAO_TOKEN = 'MS4wLjABAAAAj4gckR1Jz9y9WQtlx3iFa1V2YOpOaBP4GWTeqq_lWTNHRU_x9JgDQTGWEh2WPteh';
const LIMIT = 50;

async function loadLocalEnv() {
  try {
    const content = await fs.readFile(path.join(PROJECT_DIR, '.env.local'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function responseJson(response) {
  try {
    return JSON.parse(response.body || '{}');
  } catch {
    const preview = String(response.body || '').replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(`Expected JSON from ${response.url || 'request'} (${response.status}): ${preview}`);
  }
}

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateLabel(value, fallback) {
  if (fallback) return fallback;
  const label = String(value || '').trim();
  const now = new Date();
  const exact = label.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (exact) {
    return `${exact[1]}-${exact[2].padStart(2, '0')}-${exact[3].padStart(2, '0')}`;
  }

  const monthDay = label.match(/(\d{1,2})[-月](\d{1,2})/);
  if (monthDay) {
    let year = now.getFullYear();
    if (Number(monthDay[1]) > now.getMonth() + 1) year -= 1;
    return `${year}-${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`;
  }

  let days = 0;
  if (label.includes('前天')) days = 2;
  else if (label.includes('昨天')) days = 1;
  else days = Number(label.match(/(\d+)天前/)?.[1] || 0);
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return localDate(date);
}

function uniqueRecent(articles) {
  const seen = new Set();
  return articles
    .filter(article => article.title && article.url && article.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(article => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    })
    .slice(0, LIMIT);
}

await loadLocalEnv();

const cronSecret = process.env.CRON_SECRET;
const dryRun = process.env.EGO_SYNC_DRY_RUN === '1'
  || await fs.access(path.join(PROJECT_DIR, '.ego-sync-dry-run')).then(() => true, () => false);

const task = await taskSpace(Number(process.env.EGO_TASK_SPACE_ID || 28));
const { resolveEgoContentPages } = await import(path.join(PROJECT_DIR, 'scripts/ego-content-pages.mjs'));
const {
  zhihu: zhihuPage,
  oschina: oschinaPage,
  cto: ctoPage,
  toutiao: toutiaoPage,
  dashboard: dashboardPage,
} = await resolveEgoContentPages(task, [
  { key: 'zhihu', url: 'https://www.zhihu.com/creator/manage/creation/article' },
  { key: 'oschina', url: `https://my.oschina.net/u/${OSCHINA_USER_ID}` },
  { key: 'cto', url: `https://blog.51cto.com/u_${CTO_USER_ID}` },
  { key: 'toutiao', url: `https://www.toutiao.com/c/user/token/${TOUTIAO_TOKEN}/` },
  { key: 'dashboard', url: `${DASHBOARD_BASE}/content` },
]);

if (!(await dashboardPage.url()).startsWith(DASHBOARD_BASE)) {
  await dashboardPage.goto(`${DASHBOARD_BASE}/content`);
}

async function existingDates(platform) {
  const response = await dashboardPage.fetch(
    `${DASHBOARD_BASE}/api/articles?platform=${platform}&all=true`,
  );
  if (!response.ok) throw new Error(`${platform} article lookup returned ${response.status}`);
  const payload = responseJson(response);
  return new Map((payload.data || []).map(article => [article.article_url, article.date]));
}

async function upload(platform, articles) {
  const prepared = uniqueRecent(articles);
  if (prepared.length === 0) throw new Error(`${platform} returned no articles`);
  if (dryRun) {
    console.log(JSON.stringify({ platform, articles: prepared.length, sample: prepared.slice(0, 2) }));
    return;
  }

  const response = await dashboardPage.fetch(`${DASHBOARD_BASE}/api/browser-content/sync`, {
    method: 'POST',
    headers: {
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platform, articles: prepared }),
  });
  const payload = responseJson(response);
  if (!response.ok || !payload.success) {
    throw new Error(`${platform} upload failed: ${payload.error || response.status}`);
  }
  console.log(JSON.stringify({ platform, articles: payload.articles, success: true }));
}

async function resolvePublishedDates(page, articles, knownDates, pattern) {
  const resolved = new Map(knownDates);
  const missing = articles.filter(article => !resolved.has(article.url));

  for (let index = 0; index < missing.length; index += 5) {
    const batch = missing.slice(index, index + 5);
    const results = await Promise.all(batch.map(async article => {
      try {
        const response = await page.fetch(article.url);
        return [article.url, response.body?.match(pattern)?.[1]];
      } catch {
        return [article.url, undefined];
      }
    }));
    for (const [url, date] of results) {
      if (date) resolved.set(url, date);
    }
  }

  return resolved;
}

async function collectOsChina() {
  await oschinaPage.goto(`https://my.oschina.net/u/${OSCHINA_USER_ID}`);
  const articles = [];
  const cursor = new Date();

  for (let offset = 0; offset < 8 && articles.length < LIMIT; offset += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - offset, 1);
    const period = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const endpoint = `https://apiv1.oschina.net/oschinapi/blog/otherUser/web?pageNum=1&pageSize=50&userId=${OSCHINA_USER_ID}&period=${period}`;
    const response = await oschinaPage.fetch(endpoint);
    const records = responseJson(response).result?.records || [];
    articles.push(...records.map(record => ({
      title: record.title,
      url: `https://my.oschina.net/u/${OSCHINA_USER_ID}/blog/${record.id}`,
      date: record.createTime?.slice(0, 10),
      views: record.viewCount,
      likes: record.voteCount,
      comments: record.commentCount,
    })));
  }

  return uniqueRecent(articles);
}

async function collect51Cto() {
  const knownDates = await existingDates('ctoutiao');
  const articles = [];

  for (const suffix of ['', '/p_2']) {
    await ctoPage.goto(`https://blog.51cto.com/u_${CTO_USER_ID}${suffix}`);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const count = await ctoPage.evaluate(() => (
        document.querySelectorAll('.common-article-list').length
      ));
      if (count >= 30) break;
      await ctoPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await ctoPage.waitForTimeout(500);
    }
    const pageArticles = await ctoPage.evaluate(() => (
      Array.from(document.querySelectorAll('.common-article-list')).map(card => ({
        title: card.querySelector('.title a')?.textContent?.trim() || '',
        url: card.querySelector('.title a')?.href || '',
        dateLabel: card.querySelector('.actions')?.textContent?.trim() || '',
        views: Number(card.querySelector('.nums b')?.textContent?.replace(/,/g, '') || 0),
      }))
    ));
    articles.push(...pageArticles);
  }

  const articleUrlPattern = new RegExp(`^https://blog\\.51cto\\.com/u_${CTO_USER_ID}/\\d+$`);
  const recentArticles = articles
    .filter(article => articleUrlPattern.test(article.url))
    .slice(0, LIMIT);

  const dates = await resolvePublishedDates(
    ctoPage,
    recentArticles,
    knownDates,
    /"pubDate":"(\d{4}-\d{2}-\d{2})T/,
  );
  return uniqueRecent(recentArticles.map(article => ({
    ...article,
    date: parseDateLabel(article.dateLabel, dates.get(article.url)),
  })));
}

async function collectToutiao() {
  const knownDates = await existingDates('toutiao');
  await toutiaoPage.goto(`https://www.toutiao.com/c/user/token/${TOUTIAO_TOKEN}/`);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const count = await toutiaoPage.evaluate(() => (
      document.querySelectorAll('.profile-article-card-wrapper').length
    ));
    if (count >= LIMIT) break;
    await toutiaoPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await toutiaoPage.waitForTimeout(800);
  }

  const articles = await toutiaoPage.evaluate(() => (
    Array.from(document.querySelectorAll('.profile-article-card-wrapper')).map(card => ({
      title: card.querySelector('a.title')?.textContent?.trim() || '',
      url: card.querySelector('a.title')?.href || '',
      dateLabel: card.querySelector('.feed-card-footer-time-cmp')?.textContent?.trim() || '',
      views: Number(card.querySelector('.profile-feed-card-tools-text')?.textContent?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') || 0),
      comments: Number(card.querySelector('a[aria-label^="评论数"]')?.getAttribute('aria-label')?.match(/\d+/)?.[0] || 0),
    }))
  ));

  const dates = await resolvePublishedDates(
    toutiaoPage,
    articles,
    knownDates,
    /\b(20\d{2}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}\+08:00/,
  );
  return uniqueRecent(articles.map(article => ({
    ...article,
    date: parseDateLabel(article.dateLabel, dates.get(article.url)),
  })));
}

async function collectZhihu() {
  await zhihuPage.goto('https://www.zhihu.com/creator/manage/creation/article');
  if (!(await zhihuPage.url()).includes('/creator/manage/creation')) {
    throw new Error('Zhihu login expired in ego-lite');
  }

  const articles = [];
  for (const offset of [0, 20, 40]) {
    const endpoint = `https://www.zhihu.com/api/v4/creators/creations/v2/article?start=0&end=0&limit=20&offset=${offset}&need_co_creation=1&sort_type=created`;
    const response = await zhihuPage.fetch(endpoint);
    if (!response.ok) throw new Error(`Zhihu API returned ${response.status}`);
    const payload = responseJson(response);
    articles.push(...(payload.data || []).map(item => ({
      title: item.data?.title,
      url: `https://zhuanlan.zhihu.com/p/${item.data?.url_token}`,
      date: localDate(new Date(Number(item.data?.created_time) * 1000)),
      views: item.reaction?.read_count,
      likes: item.reaction?.vote_up_count,
      comments: item.reaction?.comment_count,
    })));
    if (payload.paging?.is_end) break;
  }

  return uniqueRecent(articles);
}

const collectors = [
  ['oschina', collectOsChina],
  ['ctoutiao', collect51Cto],
  ['toutiao', collectToutiao],
  ['zhihu', collectZhihu],
];

for (const [platform, collect] of collectors) {
  try {
    await upload(platform, await collect());
  } catch (error) {
    console.error(JSON.stringify({ platform, success: false, error: String(error) }));
    process.exitCode = 1;
  }
}
