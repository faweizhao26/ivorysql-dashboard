import type { ContributorActivityItem } from './contributor-activity';
import type { CommunityEvent } from './db';

export function githubTimeline(months: { contributions?: ContributorActivityItem[] }[], archive: CommunityEvent[], start: string, end: string): CommunityEvent[] {
  const result = new Map<string, CommunityEvent>();
  const covered = new Set<string>();
  const inRange = (day: string) => day >= start && day <= end;
  for (const month of months) {
    for (const item of month.contributions ?? []) {
      const pr = item.type === 'pr';
      const url = item.url || `https://github.com/IvorySQL/IvorySQL/${pr ? 'pull' : 'issues'}/${item.number}`;
      const add = (timestamp: string, action: string) => {
        const date = timestamp.slice(0, 10);
        if (!inRange(date)) return;
        const key = date + '|' + url;
        covered.add(key);
        result.set(key + '|' + action, {
          date, url, event_type: pr ? 'github_pr' : 'github_issue', source: action,
          title: '#' + item.number + (item.title ? ' · ' + item.title : ''),
          description: item.author,
        });
      };
      add(item.created_at, pr ? 'PR 提交' : 'Issue 创建');
      if (pr && item.merged_at) add(item.merged_at, 'PR 合并');
    }
  }
  for (const e of archive) {
    if (!inRange(e.date) || !['github_pr','github_issue'].includes(e.event_type)) continue;
    const key = e.date + '|' + (e.url || e.event_type + ':' + e.title);
    if (!covered.has(key) && !result.has(key)) result.set(key,e);
  }
  const order = new Intl.Collator('en', { numeric: true });
  return [...result.values()].sort((a,b) => b.date.localeCompare(a.date) || order.compare(b.title,a.title) || a.source.localeCompare(b.source));
}
