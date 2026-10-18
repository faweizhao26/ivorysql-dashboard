export async function openEgoContentTask(id, api, expectedName) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid EGO_TASK_SPACE_ID');
  if (typeof api.listTaskSpaces === 'function') {
    const space = (await api.listTaskSpaces()).find(entry => entry.id === id);
    if (!space) throw new Error(`采集工作区 ${id} 不存在，请恢复后再运行`);
    if (expectedName && space.name !== expectedName) throw new Error('采集工作区名称不匹配，未接管其他工作区');
    if (space.ownership === 'user') {
      if (typeof api.claimTaskSpace !== 'function') throw new Error('无法接管已保留的采集工作区');
      return api.claimTaskSpace(id);
    }
  }
  return api.taskSpace(id);
}

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
