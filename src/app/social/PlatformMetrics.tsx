import { formatFreshnessLabel, type DataSlice } from '@/lib/data-slices';
import type { SocialStats } from '@/lib/db';
import { metricChange } from '@/lib/metric-periods';

type Snapshot = DataSlice<SocialStats>;

function snapshotLabel(slice?: Snapshot) {
  if (slice?.data_date && !slice.has_exact_data) {
    return `区间内无快照，最新可用数据：${slice.data_date}`;
  }
  return formatFreshnessLabel(slice);
}

function metrics(row?: SocialStats | null) {
  return {
    followers: row ? row.followers || row.subscribers : undefined,
    posts: row?.posts,
    views: row ? row.views || row.video_views : undefined,
  };
}

export function PlatformMetrics({ current, previous, compare, accent }: {
  current?: Snapshot; previous?: Snapshot; compare: boolean; accent: string;
}) {
  const values = metrics(current?.data);
  const before = metrics(previous?.has_exact_data ? previous.data : null);
  const sameSnapshot = current?.has_exact_data && previous?.has_exact_data && current.data_date === previous.data_date;

  function comparisonLine(key: keyof typeof values) {
    const baseline = before[key];
    if (!compare || baseline === undefined) return null;
    const change = current?.has_exact_data && !sameSnapshot ? metricChange(values[key], baseline) : undefined;
    return (
      <p className="mt-1 text-xs text-slate-400">
        对比期 {baseline.toLocaleString()}
        {change !== undefined && <span className={change >= 0 ? 'ml-2 text-emerald-400' : 'ml-2 text-red-400'}>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>}
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}15` }}>
        <div className="text-slate-400 text-xs font-medium mb-1">粉丝 / 订阅者</div>
        <div className="text-3xl font-bold text-slate-100">{values.followers?.toLocaleString() ?? '-'}</div>
        {comparisonLine('followers')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/50 rounded-xl p-4 text-center">
          <div className="text-slate-500 text-xs mb-1">帖子 / 视频</div>
          <div className="text-xl font-bold text-slate-200">{values.posts?.toLocaleString() ?? '-'}</div>
          {comparisonLine('posts')}
        </div>
        <div className="bg-slate-900/50 rounded-xl p-4 text-center">
          <div className="text-slate-500 text-xs mb-1">阅读 / 播放</div>
          <div className="text-xl font-bold text-slate-200">
            {values.views === undefined ? '-' : values.views >= 10000 ? `${(values.views / 10000).toFixed(1)}万` : values.views.toLocaleString()}
          </div>
          {comparisonLine('views')}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{snapshotLabel(current)}</p>
      {compare && <p className="mt-1 text-xs text-slate-500">对比期：{snapshotLabel(previous)}{sameSnapshot && '（同一快照，不计算环比）'}</p>}
    </>
  );
}
