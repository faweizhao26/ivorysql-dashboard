function readToutiaoCards() {
  return Array.from(document.querySelectorAll('.profile-article-card-wrapper')).map(card => ({
    title: card.querySelector('a.title')?.textContent?.trim() || '',
    url: card.querySelector('a.title')?.href || '',
    dateLabel: card.querySelector('.feed-card-footer-time-cmp')?.textContent?.trim() || '',
    views: card.querySelector('.profile-feed-card-tools-text')?.textContent,
    comments: card.querySelector('a[aria-label^="评论数"]')?.getAttribute('aria-label'),
  }));
}

function advanceToutiaoFeed() {
  let container = document.querySelector('.profile-article-card-wrapper')?.parentElement;
  while (container && container !== document.body) {
    const style = window.getComputedStyle(container);
    if (/(auto|scroll)/.test(style.overflowY) && container.scrollHeight > container.clientHeight) {
      container.scrollBy(0, Math.max(400, container.clientHeight * 0.8));
      return;
    }
    container = container.parentElement;
  }
  window.scrollBy(0, Math.max(400, window.innerHeight * 0.8));
}

export async function collectToutiaoCards(page, limit = 50) {
  const articles = new Map();
  let idle = 0;
  // Keep cards as we scroll: virtualized feeds may remove earlier DOM nodes.
  for (let step = 0; step < 60; step += 1) {
    const cards = await page.evaluate(readToutiaoCards);
    for (const card of cards) {
      if (card.title && /^https:\/\/www\.toutiao\.com\/article\/\d+\/?(?:\?.*)?$/.test(card.url)) articles.set(card.url, card);
    }
    if (articles.size >= limit) return [...articles.values()].slice(0, limit);
    await page.evaluate(advanceToutiaoFeed);
    try {
      await page.waitForFunction(known => {
        const seen = new Set(known);
        return Array.from(document.querySelectorAll('.profile-article-card-wrapper a.title'))
          .some(link => !seen.has(link.href));
      }, [...articles.keys()], { timeout: 3000 });
      idle = 0;
    } catch (error) {
      if (!/timeout|timed out/i.test(error instanceof Error ? error.message : String(error))) throw error;
      if (++idle >= 4) break;
    }
  }
  throw new Error(`头条采集不完整：仅获取 ${articles.size}/${limit} 篇，本平台未写入；请检查页面加载、登录状态或页面结构`);
}
