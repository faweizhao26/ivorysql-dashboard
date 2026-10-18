const fs = await import('node:fs/promises');
const path = await import('node:path');

const PROJECT_DIR = '/Users/felixzhao/ivorysql-dashboard';
const OSCHINA_USER_ID = '5729420';
const CTO_USER_ID = '17240866';
const TOUTIAO_TOKEN = 'MS4wLjABAAAAj4gckR1Jz9y9WQtlx3iFa1V2YOpOaBP4GWTeqq_lWTNHRU_x9JgDQTGWEh2WPteh';
const LIMIT = 50;
const { normalizeMetric, isArticleDate, localArticleDate: localDate, parseArticleDate: parseDateLabel } =
  await import(path.join(PROJECT_DIR, 'src/lib/content-values.mjs'));

async function loadLocalEnv() {
  try {
    const content = await fs.readFile(path.join(PROJECT_DIR, '.env.local'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const workspaceSetting = match[1] === 'EGO_TASK_SPACE_ID' || match[1] === 'EGO_TASK_SPACE_NAME';
      if (process.env[match[1]] && !workspaceSetting) continue;
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

function uniqueRecent(articles) {
  const undated = articles.find(article => article.title && article.url && !isArticleDate(article.date));
  if (undated) throw new Error(`无法确认文章发布日期，未写入本平台数据: ${undated.url}`);
  const seen = new Set();
  return articles
    .filter(article => article.title && article.url && article.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(article => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    })
    .slice(0, LIMIT)
    .map(article => ({ ...article, views: normalizeMetric(article.views), likes: normalizeMetric(article.likes), comments: normalizeMetric(article.comments) }));
}

await loadLocalEnv();

const DASHBOARD_BASE = process.env.EGO_DASHBOARD_BASE || 'https://ivorysql-dashboard.vercel.app';
const dryRun = process.env.EGO_SYNC_DRY_RUN === '1'
  || await fs.access(path.join(PROJECT_DIR, '.ego-sync-dry-run')).then(() => true, () => false);
const { createDashboardClient, runCollectors } = await import(path.join(PROJECT_DIR, 'scripts/ego-dashboard-client.mjs'));
const dashboard = createDashboardClient({ baseUrl: DASHBOARD_BASE, adminPassword: process.env.ADMIN_PASSWORD, cronSecret: process.env.CRON_SECRET });
await dashboard.preflight();

const { resolveEgoContentPages, openEgoContentTask } = await import(path.join(PROJECT_DIR, 'scripts/ego-content-pages.mjs'));
let taskPromise;
async function contentPage(key, url) {
  taskPromise ||= Promise.resolve().then(() => openEgoContentTask(Number(process.env.EGO_TASK_SPACE_ID || 28), {
    taskSpace,
    listTaskSpaces: typeof listTaskSpaces === 'function' ? listTaskSpaces : undefined,
    claimTaskSpace: typeof claimTaskSpace === 'function' ? claimTaskSpace : undefined,
  }, process.env.EGO_TASK_SPACE_NAME));
  const task = await taskPromise;
  const pages = await resolveEgoContentPages(task, [{ key, url }]);
  return pages[key];
}

async function existingDates(platform) {
  return dashboard.existingDates(platform);
}

async function upload(platform, articles) {
  const prepared = uniqueRecent(articles);
  if (prepared.length === 0) throw new Error(`${platform} returned no articles`);
  if (dryRun) {
    return { articles: prepared.length, dryRun: true, sample: prepared.slice(0, 2) };
  }
  const payload = await dashboard.upload(platform, prepared);
  return { articles: payload.articles };
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
  const oschinaPage = await contentPage('oschina', `https://my.oschina.net/u/${OSCHINA_USER_ID}`);
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
  const ctoPage = await contentPage('cto', `https://blog.51cto.com/u_${CTO_USER_ID}`);
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
        views: card.querySelector('.nums b')?.textContent,
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
  const toutiaoPage = await contentPage('toutiao', `https://www.toutiao.com/c/user/token/${TOUTIAO_TOKEN}/`);
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
      views: card.querySelector('.profile-feed-card-tools-text')?.textContent,
      comments: card.querySelector('a[aria-label^="评论数"]')?.getAttribute('aria-label'),
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
  const zhihuPage = await contentPage('zhihu', 'https://www.zhihu.com/creator/manage/creation/article');
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

const results = await runCollectors(collectors, upload,
  async (platform, error) => { if (dryRun) return false; await dashboard.reportFailure(platform, error); },
  result => (result.success ? console.log : console.error)(JSON.stringify(result)),
);
if (results.some(result => !result.success)) process.exitCode = 1;
if (taskPromise) {
  const task = await taskPromise.catch(() => null);
  if (typeof task?.handOff === 'function') await task.handOff();
}
