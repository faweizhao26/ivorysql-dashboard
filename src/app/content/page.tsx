'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { ContentPlatformCards } from '@/components/ContentPlatformCards';
import { ContentDateFilter } from '@/components/ContentDateFilter';
import { useContentOverview } from '@/lib/use-content-overview';
import { CONTENT_PLATFORMS, contentDateQuery, publicationRangeQuery, resolveContentPlatform, type ContentPlatformKey } from '@/lib/content-overview';
import { parseArticleDateRange, type ArticleDateRange } from '@/lib/article-query';
import { useAuth } from '@/app/auth-provider';
import LastUpdated from '@/components/LastUpdated';
import { formatArticleMetric } from '@/lib/content-values.mjs';

interface ArticleDetail {
  id?: number;
  date: string;
  published_date?: string;
  platform: string;
  article_title: string;
  article_url?: string;
  views: number | null;
  likes: number;
  comments: number;
  content_category?: string;
  content_source?: string;
}

const categories = [
  'PG 技术日志', '社区活动相关', '社区新闻动态', '发版公告',
  'IvorySQL 技术文章-研发供稿', 'IvorySQL 技术文章-来自社区',
  'PG 技术文章-非翻译', 'PG 技术文章-翻译', 'HOW 2026 演讲整理',
  'HOW 2025 演讲整理', '节日祝福', '其他',
];

export default function ContentPage() {
  return <Suspense fallback={<div className="py-24 text-center text-slate-400">加载中...</div>}><ContentPageRoute /></Suspense>;
}

function ContentPageRoute() {
  const params = useSearchParams();
  let dateRange: ArticleDateRange | undefined;
  try {
    dateRange = parseArticleDateRange(params);
  } catch {
    return <div role="alert" className="space-y-3 text-sm text-red-400"><p>发布日期范围无效，请选择有效的开始和结束日期。</p><Link href="/content" className="text-indigo-300">查看全部日期</Link></div>;
  }
  return <ContentPageContent key={`${dateRange?.start || ''}/${dateRange?.end || ''}`} dateRange={dateRange} />;
}

function ContentPageContent({ dateRange }: { dateRange?: ArticleDateRange }) {
  const { accessLevel } = useAuth();
  const isAdmin = accessLevel === 'admin';
  const searchParams = useSearchParams();
  const selectedPlatform = resolveContentPlatform(searchParams.get('platform'));
  const { overview, loading, error: summaryError, refresh: loadSummaries } = useContentOverview(dateRange);
  const start = dateRange?.start;
  const end = dateRange?.end;
  const [items, setItems] = useState<ArticleDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleDetail | null>(null);
  const [listError, setListError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [saving, setSaving] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const articleController = useRef<AbortController | null>(null);
  const mutationPending = useRef(false);
  const pageSize = 10;

  function selectPlatform(platform: ContentPlatformKey) {
    const query = new URLSearchParams(searchParams.toString());
    query.set('platform', platform);
    setPage(1);
    window.history.pushState(null, '', `/content?${query}`);
  }

  const loadArticles = useCallback(async () => {
    articleController.current?.abort();
    const controller = new AbortController();
    articleController.current = controller;
    setListLoading(true);
    setListError('');
    const query = new URLSearchParams({ platform: selectedPlatform, page: String(page), pageSize: String(pageSize) });
    if (start && end) { query.set('start', start); query.set('end', end); }
    if (search.trim()) query.set('search', search.trim());
    if (category) query.set('category', category);
    try {
      const response = await fetch(`/api/content/articles?${query}`, { credentials: 'include', signal: controller.signal });
      if (!response.ok) throw new Error('Failed to load articles');
      const data = await response.json();
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil((data.total || 0) / pageSize));
      if (page > lastPage) { setPage(lastPage); return; }
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      if (!controller.signal.aborted) { setItems([]); setListError('文章加载失败，请重试'); }
    } finally {
      if (!controller.signal.aborted) setListLoading(false);
    }
  }, [selectedPlatform, page, search, category, start, end]);

  useEffect(() => {
    setListLoading(true);
    const timer = setTimeout(() => { void loadArticles(); }, 200);
    return () => { clearTimeout(timer); articleController.current?.abort(); };
  }, [loadArticles, listVersion]);

  const selectedName = CONTENT_PLATFORMS.find(item => item.key === selectedPlatform)?.name || selectedPlatform;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const exportQuery = contentDateQuery(dateRange);
  const platformExportQuery = new URLSearchParams(exportQuery);
  platformExportQuery.set('platform', selectedPlatform);

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingArticle?.id || mutationPending.current) return;
    mutationPending.current = true; setSaving(true); setWriteError('');
    try {
      const response = await fetch('/api/articles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingArticle.id,
        article_title: editingArticle.article_title,
        content_category: editingArticle.content_category,
        content_source: editingArticle.content_source,
      }),
    });
      if (!response.ok) throw new Error((await response.json()).error || '文章保存失败，请重试');
      setEditingArticle(null);
      setListVersion(version => version + 1);
      await loadSummaries();
    } catch (error) { setWriteError(error instanceof Error ? error.message : '文章保存失败，请重试'); }
    finally { mutationPending.current = false; setSaving(false); }
  }

  async function deleteArticle(article: ArticleDetail) {
    if (!article.id || mutationPending.current || !confirm('确定要删除这篇文章吗？')) return;
    mutationPending.current = true; setSaving(true); setWriteError('');
    try {
      const response = await fetch(`/api/articles?id=${article.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || '文章删除失败');
      setListVersion(version => version + 1);
      await loadSummaries();
    } catch (error) { setWriteError(error instanceof Error ? error.message : '文章删除失败，请重试'); }
    finally { mutationPending.current = false; setSaving(false); }
  }

  if (loading && !overview) return <div className="py-24 text-center text-slate-400">加载中...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">技术内容平台</h1>
          <p className="mt-1 text-xs text-slate-500">{dateRange ? `发布日期：${dateRange.start} ~ ${dateRange.end}` : '全部日期'} · 当前累计阅读</p>
          <p className="mt-1 text-xs text-slate-500"><LastUpdated value={overview?.updated_at ?? null} /></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">{dateRange && <Link href={`/content?platform=${selectedPlatform}`} className="text-sm text-indigo-300">全部日期</Link>}<a href={`/api/content/export${exportQuery.size ? `?${exportQuery}` : ''}`} className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 text-sm">导出{dateRange ? '当前范围' : '全部'} CSV</a></div>
      </header>
      <ContentDateFilter dateRange={dateRange} onChange={range => {
        const query = publicationRangeQuery(new URLSearchParams(searchParams.toString()), range);
        setPage(1);
        window.history.pushState(null, '', `/content${query.size ? `?${query}` : ''}`);
      }} />
      {(summaryError || writeError) && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-400"><span>{summaryError || writeError}</span>{summaryError && <button type="button" aria-label="重试平台汇总" onClick={() => { setListVersion(version => version + 1); void loadSummaries(); }} className="inline-flex items-center gap-1 text-slate-300"><RefreshCw size={14} />重试</button>}</div>}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">平台汇总</h2>
        <ContentPlatformCards summaries={overview?.platforms || []} selectedPlatform={selectedPlatform} onSelect={selectPlatform} loading={loading} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{selectedName} 文章</h2>
            <p className="text-sm text-slate-500">共 {listLoading || listError ? '-' : total.toLocaleString()} 篇</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="搜索标题" className="w-44 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200" />
            <select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200">
              <option value="">全部分类</option>{categories.map(item => <option key={item}>{item}</option>)}
            </select>
            <a href={`/api/content/export?${platformExportQuery}`} className="px-3 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-800">导出</a>
          </div>
        </div>

        {listError && <div role="alert" className="mb-3 flex items-center gap-3 text-sm text-red-400"><span>{listError}</span><button type="button" aria-label="重试文章列表" onClick={() => { void loadArticles(); }} className="inline-flex items-center gap-1 text-slate-300"><RefreshCw size={14} />重试</button></div>}
        <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800/50">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-slate-700 bg-slate-900/50">
              <th className="px-4 py-3 text-left text-slate-400">发布日期</th><th className="px-4 py-3 text-left text-slate-400">标题</th>
              <th className="px-4 py-3 text-left text-slate-400">分类</th><th className="px-4 py-3 text-left text-slate-400">来源</th>
              <th className="px-4 py-3 text-right text-slate-400">累计阅读</th>{isAdmin && <th className="px-4 py-3 text-left text-slate-400">操作</th>}
            </tr></thead>
            <tbody>
              {listLoading ? <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-slate-500">加载中...</td></tr> : items.length === 0 ? <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-slate-500">{listError ? '文章暂不可用' : '暂无匹配文章'}</td></tr> : items.map(article => (
                <tr key={article.id} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-4 py-3 text-slate-400">{article.published_date || article.date}</td>
                  <td className="max-w-md px-4 py-3"><a href={article.article_url || '#'} target={article.article_url ? '_blank' : undefined} rel="noreferrer" className="text-indigo-400 hover:underline">{article.article_title}</a></td>
                  <td className="px-4 py-3 text-slate-400">{article.content_category || '-'}</td><td className="px-4 py-3 text-slate-400">{article.content_source || '-'}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{formatArticleMetric(article.views)}</td>
                  {isAdmin && <td className="px-4 py-3"><button disabled={saving} onClick={() => { setWriteError(''); setEditingArticle({ ...article }); }} className="mr-3 text-indigo-400">编辑</button><button disabled={saving} onClick={() => deleteArticle(article)} className="text-red-400">删除</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-center items-center gap-3 text-sm text-slate-400">
          <button disabled={listLoading || Boolean(listError) || page <= 1} onClick={() => setPage(value => value - 1)} className="px-3 py-1.5 border border-slate-600 rounded disabled:opacity-40">上一页</button>
          <span>第 {page} / {listLoading || listError ? '-' : totalPages} 页</span>
          <button disabled={listLoading || Boolean(listError) || page >= totalPages} onClick={() => setPage(value => value + 1)} className="px-3 py-1.5 border border-slate-600 rounded disabled:opacity-40">下一页</button>
        </div>
      </section>

      {editingArticle && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={() => { if (!saving) setEditingArticle(null); }}>
          <form onSubmit={saveEdit} onMouseDown={event => event.stopPropagation()} className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">编辑文章</h3>
            <input required value={editingArticle.article_title} onChange={event => setEditingArticle({ ...editingArticle, article_title: event.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-slate-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={editingArticle.content_category || ''} onChange={event => setEditingArticle({ ...editingArticle, content_category: event.target.value })} className="px-3 py-2 bg-slate-950 border border-slate-600 rounded text-slate-200"><option value="">未分类</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
              <input value={editingArticle.content_source || ''} onChange={event => setEditingArticle({ ...editingArticle, content_source: event.target.value })} placeholder="内容来源" className="px-3 py-2 bg-slate-950 border border-slate-600 rounded text-slate-200" />
            </div>
            {writeError && <p role="alert" className="text-sm text-red-400">{writeError}</p>}
            <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setEditingArticle(null)} className="px-4 py-2 text-slate-300">取消</button><button type="submit" disabled={saving} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
