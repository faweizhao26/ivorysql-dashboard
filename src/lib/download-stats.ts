import { getDownloadStatsHistory, saveDownloadStats } from './db';
import { getBeijingDate } from './date';

export interface DownloadRelease {
  tag: string;
  date?: string;
  total: number;
  assets: Array<{ name: string; downloads: number }>;
}

export interface DockerRepo { name: string; pulls: number }

type SourceState = { status: 'live' | 'stale' | 'unavailable'; data_date: string | null; error?: string };
export type GitHubDownloads = SourceState & { total: number | null; releases: DownloadRelease[] };
export type DockerDownloads = SourceState & { total: number | null; repos: DockerRepo[] };
export interface DownloadSummary { github: GitHubDownloads; docker: DockerDownloads; partial: boolean; mirror: null }

interface Options { fetcher?: typeof fetch; token?: string; repo?: string }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('下载接口返回了无效记录');
  return value as Record<string, unknown>;
}

function counter(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('下载接口缺少有效计数，未使用零代替');
  return value;
}

function sum(values: number[]): number {
  return counter(values.reduce((total, value) => total + value, 0));
}

async function json(url: string, source: string, options: Options, headers?: HeadersInit): Promise<unknown> {
  const response = await (options.fetcher || fetch)(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${source} 下载统计获取失败（HTTP ${response.status}）`);
  try { return await response.json(); }
  catch { throw new Error(`${source} 下载接口未返回有效 JSON`); }
}

export async function collectGitHubDownloads(options: Options = {}) {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repo = options.repo ?? process.env.GITHUB_REPO ?? 'IvorySQL/IvorySQL';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Invalid GITHUB_REPO');
  const releases: DownloadRelease[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = await json(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, 'GitHub', options, {
      ...(token ? { Authorization: `Bearer ${token}` } : {}), 'User-Agent': 'IvorySQL-Dashboard',
    });
    if (!Array.isArray(data)) throw new Error('GitHub 下载接口未返回完整版本列表');
    for (const item of data) {
      const release = record(item);
      if (typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) throw new Error('GitHub 版本缺少文件明细');
      const assets = release.assets.map(value => {
        const asset = record(value);
        if (typeof asset.name !== 'string') throw new Error('GitHub 文件缺少名称');
        return { name: asset.name, downloads: counter(asset.download_count) };
      });
      releases.push({ tag: release.tag_name, date: typeof release.published_at === 'string' ? release.published_at.slice(0, 10) : undefined, total: sum(assets.map(asset => asset.downloads)), assets });
    }
    if (data.length < 100) return { total: sum(releases.map(release => release.total)), releases };
  }
  throw new Error('GitHub 版本分页未结束，未保存不完整统计');
}

export async function collectDockerDownloads(options: Options = {}) {
  const root = 'https://hub.docker.com/v2/repositories/ivorysql/';
  let next: string | null = `${root}?page_size=100`;
  const seen = new Set<string>();
  const repos = new Map<string, DockerRepo>();
  let expectedCount: number | undefined;
  while (next) {
    const url = new URL(next, root);
    if (url.origin !== 'https://hub.docker.com' || url.pathname !== new URL(root).pathname || seen.has(url.href) || seen.size >= 100) {
      throw new Error('Docker Hub 分页无效，未保存不完整统计');
    }
    seen.add(url.href);
    const data = record(await json(url.href, 'Docker Hub', options));
    if (!Array.isArray(data.results)) throw new Error('Docker Hub 未返回完整镜像列表');
    if (data.count !== undefined) expectedCount = counter(data.count);
    for (const value of data.results) {
      const item = record(value);
      if (typeof item.name !== 'string' || repos.has(item.name)) throw new Error('Docker Hub 镜像列表无效');
      repos.set(item.name, { name: item.name, pulls: counter(item.pull_count) });
    }
    if (data.next !== null && typeof data.next !== 'string') throw new Error('Docker Hub 缺少分页结束标记');
    next = data.next as string | null;
  }
  if (expectedCount !== undefined && repos.size !== expectedCount) throw new Error('Docker Hub 镜像列表不完整');
  const values = [...repos.values()];
  return { total: sum(values.map(repo => repo.pulls)), repos: values };
}

export async function recordDownloadSnapshot(date: string, options: Options & { save?: typeof saveDownloadStats } = {}): Promise<void> {
  const [github, docker] = await Promise.all([collectGitHubDownloads(options), collectDockerDownloads(options)]);
  await (options.save || saveDownloadStats)(date, github.total, docker.total);
}

export async function getDownloadSummary(options: Options & { history?: typeof getDownloadStatsHistory } = {}): Promise<DownloadSummary> {
  const [github, docker] = await Promise.allSettled([collectGitHubDownloads(options), collectDockerDownloads(options)]);
  const partial = github.status === 'rejected' || docker.status === 'rejected';
  const history = partial ? await (options.history || getDownloadStatsHistory)(3650).catch(() => []) : [];
  history.sort((a, b) => b.date.localeCompare(a.date));
  function fallback(field: 'github_total' | 'docker_total', error: unknown) {
    const previous = history.find(row => Number.isSafeInteger(row[field]) && row[field] >= 0);
    return { total: previous?.[field] ?? null, data_date: previous?.date ?? null, status: previous ? 'stale' as const : 'unavailable' as const, error: error instanceof Error ? error.message : '下载统计获取失败' };
  }
  const live = { status: 'live' as const, data_date: getBeijingDate() };
  return {
    github: github.status === 'fulfilled' ? { ...github.value, ...live } : { ...fallback('github_total', github.reason), releases: [] },
    docker: docker.status === 'fulfilled' ? { ...docker.value, ...live } : { ...fallback('docker_total', docker.reason), repos: [] },
    partial, mirror: null,
  };
}
