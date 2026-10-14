export async function resolveEgoContentPages(task, targets) {
  const tabs = await task.tabs();
  const selected = targets.map(({ key, url }) => {
    const target = new URL(url);
    const candidates = tabs.filter(tab => {
      try {
        return new URL(tab.url).origin === target.origin;
      } catch {
        return false;
      }
    });
    const tab = candidates.find(candidate => new URL(candidate.url).pathname.startsWith(target.pathname)) || candidates[0];
    if (!tab) {
      throw new Error(`${key}: TaskSpace ${task.spaceId} 缺少 ${target.origin} 页面，请在该空间打开并确认登录后再运行`);
    }
    return { key, tab };
  });

  const pages = [];
  for (const { key, tab } of selected) {
    pages.push([key, tab.label ? task.page(tab.label) : await task.adopt(tab.page)]);
  }
  return Object.fromEntries(pages);
}
