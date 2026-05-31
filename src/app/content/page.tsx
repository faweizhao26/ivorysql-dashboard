'use client';

import { useEffect, useState } from 'react';
import { StatCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';
import { PlatformIcon } from '@/components/PlatformIcon';
import { downloadCSV } from '@/lib/csv-utils';

interface ContentData {
  articles: Array<{
    date: string;
    platform: string;
    article_count: number;
    total_views: number;
    avg_views: number;
    likes: number;
    bookmarks: number;
    comments: number;
    followers: number;
    new_articles: number;
  }>;
}

interface ArticleDetail {
  id?: number;
  date: string;
  platform: string;
  article_title: string;
  article_url?: string;
  views: number;
  likes: number;
  comments: number;
  content_category?: string;
  content_source?: string;
}

interface ArticlesResponse {
  articles: Record<string, ArticleDetail[]>;
}

const contentPlatforms = [
  { key: 'csdn', name: 'CSDN' },
  { key: 'juejin', name: '掘金' },
  { key: 'modb', name: '墨天轮' },
  { key: 'oschina', name: '开源中国' },
  { key: 'sf', name: '思否' },
  { key: 'ctoutiao', name: '51CTO' },
  { key: 'itpub', name: 'ITPUB' },
  { key: 'toutiao', name: '头条号' },
  { key: 'ifclub', name: 'IFCLUB' },
  { key: 'zhihu', name: '知乎' },
  { key: 'cnblogs', name: '博客园' },
];

const allArticlePlatforms = [
  { key: 'wechat', name: '公众号' },
  ...contentPlatforms
];

export default function ContentPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [comparison, setComparison] = useState<Comparison | undefined>(undefined);
  const [data, setData] = useState<ContentData | null>(null);
  const [articleDetails, setArticleDetails] = useState<ArticlesResponse | null>(null);
  const [allArticleDetails, setAllArticleDetails] = useState<ArticlesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState<ArticleDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [articlePages, setArticlePages] = useState<Record<string, number>>({});
  const ARTICLES_PER_PAGE = 5;

  const isSingleDay = dateRange.start === dateRange.end;

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        });
        const [contentRes, statsArticlesRes, allArticlesRes] = await Promise.all([
          fetch(`/api/content?${params}`, { credentials: 'include' }),
          fetch(`/api/articles?start=${dateRange.start}&end=${dateRange.end}`, { credentials: 'include' }),
          fetch(`/api/articles?start=2020-01-01&end=2099-12-31`, { credentials: 'include' })
        ]);
        
        if (contentRes.ok) {
          const json = await contentRes.json();
          setData(json);
        }
        if (statsArticlesRes.ok) {
          const json = await statsArticlesRes.json();
          setArticleDetails(json);
        }
        if (allArticlesRes.ok) {
          const json = await allArticlesRes.json();
          setAllArticleDetails(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingArticle?.id) return;

    try {
      const res = await fetch('/api/articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingArticle)
      });

      if (res.ok) {
        setIsEditing(false);
        setEditingArticle(null);
        const articlesRes = await fetch(`/api/articles`, { credentials: 'include' });
        if (articlesRes.ok) {
          const json = await articlesRes.json();
          setArticleDetails(json);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteArticle(article: ArticleDetail) {
    if (!article.id) return;
    if (!confirm('确定要删除这篇文章吗？')) return;

    try {
      const res = await fetch(`/api/articles?id=${article.id}`, { method: 'DELETE' });
      if (res.ok) {
        const articlesRes = await fetch(`/api/articles`, { credentials: 'include' });
        if (articlesRes.ok) {
          const json = await articlesRes.json();
          setArticleDetails(json);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleEdit(article: ArticleDetail) {
    setEditingArticle({ ...article });
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditingArticle(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const articleDataList = data?.articles || [];
  const statsArticleDetails = articleDetails?.articles || {};
  const allArticlesForTable = allArticleDetails?.articles || {};

  const articleData = allArticlePlatforms.reduce((acc, { key }) => {
    const platformItems = articleDataList.filter(s => s.platform === key);
    const latest = platformItems[platformItems.length - 1];
    acc[key] = latest;
    return acc;
  }, {} as Record<string, any>);

  const platformDetailsFromArticles = allArticlePlatforms.reduce((acc, { key }) => {
    const articles = statsArticleDetails[key] || [];
    if (articles.length > 0) {
      const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
      const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0);
      const totalComments = articles.reduce((sum, a) => sum + (a.comments || 0), 0);
      const avgViews = Math.round(totalViews / articles.length);
      acc[key] = {
        platform: key,
        article_count: articles.length,
        total_views: totalViews,
        avg_views: avgViews,
        likes: totalLikes,
        comments: totalComments
      };
    }
    return acc;
  }, {} as Record<string, any>);

  const totals = allArticlePlatforms.reduce((acc, { key }) => {
    const articles = statsArticleDetails[key] || [];
    if (articles.length > 0) {
      acc.articles += articles.length;
      acc.views += articles.reduce((sum, a) => sum + (a.views || 0), 0);
    }
    const current = articleData[key];
    if (current) {
      acc.followers += current.followers || 0;
    }
    return acc;
  }, { articles: 0, views: 0, followers: 0 });

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;
  const displayDate = isSingleDay ? dateRange.start : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <h1 className="text-2xl font-bold text-slate-100">技术内容平台</h1>
        </div>
        <div className="flex items-center gap-3">
          {displayDate && (
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30">
              {displayDate}
            </span>
          )}
          <button
            onClick={() => exportContentData(data, statsArticleDetails, currentPeriod)}
            className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            导出 CSV
          </button>
        </div>
      </div>

      <TimeRangeSelector onRangeChange={(range) => {
        setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
        setComparison(range.comparison);
      }} />

      <div className="text-sm text-slate-400">
        当前时间段: <span className="font-medium text-slate-200">{currentPeriod}</span>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">汇总数据</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            title="文章总数"
            value={totals.articles}
            icon="📄"
          />
          <StatCard
            title="总阅读量"
            value={totals.views}
            icon="👁️"
          />
          <StatCard
            title="总粉丝数"
            value={totals.followers}
            icon="👥"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">平台详情</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {allArticlePlatforms.map(({ key, name }) => {
            const current = articleData[key];
            const articles = statsArticleDetails[key] || [];
            const platformArticleCount = articles.length;
            const platformTotalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
            const platformAvgViews = platformArticleCount > 0 ? Math.round(platformTotalViews / platformArticleCount) : 0;
            const platformLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0);
            const platformComments = articles.reduce((sum, a) => sum + (a.comments || 0), 0);
            const allTimeArticles = allArticlesForTable[key] || [];
            const allTimeTotalViews = allTimeArticles.reduce((sum: number, a: any) => sum + (a.views || 0), 0);
            const hasData = allTimeArticles.length > 0 || current?.followers;

            if (!hasData) {
              return (
                <div key={key} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 opacity-60">
                  <div className="flex items-center gap-2 mb-3">
                    <PlatformIcon platform={key} className="w-8 h-8 text-sm" />
                    <span className="font-medium text-slate-200">{name}</span>
                  </div>
                  <div className="text-sm text-slate-500">暂无数据</div>
                </div>
              );
            }

            return (
              <div key={key} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={key} className="w-8 h-8 text-sm" />
                    <span className="font-medium text-slate-200">{name}</span>
                  </div>
                  <button
                    onClick={() => exportPlatformArticles(key, name, allTimeArticles)}
                    className="text-xs text-slate-400 hover:text-indigo-400 px-2 py-1 rounded border border-slate-600 hover:border-indigo-500/50 transition-colors"
                  >
                    导出
                  </button>
                </div>
                <div className="mb-3 p-2 rounded-lg bg-slate-900/50 text-center">
                  <div className="text-xs text-slate-400">总阅读量（全部）</div>
                  <div className="text-lg font-bold text-slate-200">{allTimeTotalViews.toLocaleString()}</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">文章数（当前时段）</span>
                    <span className="font-medium text-slate-200">{platformArticleCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">阅读量（当前时段）</span>
                    <span className="font-medium text-slate-200">{platformTotalViews.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">篇均阅读</span>
                    <span className="font-medium text-slate-200">{platformAvgViews.toLocaleString()}</span>
                  </div>
                  {platformLikes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">获赞</span>
                      <span className="font-medium text-slate-200">{platformLikes.toLocaleString()}</span>
                    </div>
                  )}
                  {platformComments > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">评论</span>
                      <span className="font-medium text-slate-200">{platformComments.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isEditing && editingArticle && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">编辑文章</h3>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">日期</label>
                <input
                  type="date"
                  value={editingArticle.date}
                  onChange={(e) => setEditingArticle({ ...editingArticle, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">阅读量</label>
                <input
                  type="number"
                  value={editingArticle.views}
                  onChange={(e) => setEditingArticle({ ...editingArticle, views: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">文章标题</label>
                <input
                  type="text"
                  value={editingArticle.article_title}
                  onChange={(e) => setEditingArticle({ ...editingArticle, article_title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">内容分类</label>
                <select
                  value={editingArticle.content_category || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, content_category: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- 不设置 --</option>
                  <option>PG 技术日志</option>
                  <option>社区活动相关</option>
                  <option>社区新闻动态</option>
                  <option>发版公告</option>
                  <option>IvorySQL 技术文章-研发供稿</option>
                  <option>IvorySQL 技术文章-来自社区</option>
                  <option>PG 技术文章-非翻译</option>
                  <option>PG 技术文章-翻译</option>
                  <option>HOW 2026 演讲整理</option>
                  <option>HOW 2025 演讲整理</option>
                  <option>节日祝福</option>
                  <option>其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">内容来源</label>
                <select
                  value={editingArticle.content_source || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, content_source: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- 不设置 --</option>
                  <option>研发供稿</option>
                  <option>活动演讲</option>
                  <option>PGnexus 邮件</option>
                  <option>社区</option>
                  <option>PGWeekly</option>
                  <option>其他</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">文章链接</label>
                <input
                  type="url"
                  value={editingArticle.article_url || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, article_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
                >
                  保存修改
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
                >
                  取消
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {Object.keys(allArticlesForTable).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">文章详情列表</h2>

          {allArticlePlatforms.map(({ key, name }) => {
            const articles = allArticlesForTable[key];
            if (!articles || articles.length === 0) return null;

            const currentPage = articlePages[key] || 1;
            const totalPages = Math.ceil(articles.length / ARTICLES_PER_PAGE);
            const displayedArticles = articles.slice((currentPage - 1) * ARTICLES_PER_PAGE, currentPage * ARTICLES_PER_PAGE);

            return (
              <div key={key} className="mb-6">
                <h3 className="text-base font-medium text-slate-200 mb-3 flex items-center gap-2">
                  <PlatformIcon platform={key} className="w-6 h-6 text-sm" />
                  <span>{name}</span>
                  <span className="text-sm text-slate-400">({articles.length} 篇)</span>
                </h3>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-700">
                        <th className="text-left py-3 px-4 font-medium text-slate-400">日期</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-400">文章标题</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-400 hidden md:table-cell w-28">分类</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-400 hidden md:table-cell w-24">来源</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-400">阅读</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-400 w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedArticles.map((article, index) => (
                        <tr key={article.id || index} className="border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30">
                          <td className="py-2 px-4 text-slate-400">{article.date}</td>
                          <td className="py-2 px-4 max-w-md truncate">
                            {article.article_url ? (
                              <a
                                href={article.article_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 hover:underline"
                                title={article.article_title}
                              >
                                {article.article_title}
                              </a>
                            ) : (
                              <span className="text-slate-200" title={article.article_title}>
                                {article.article_title}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-slate-400 hidden md:table-cell text-xs">
                            {article.content_category && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">{article.content_category}</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-slate-400 hidden md:table-cell text-xs">
                            {article.content_source && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{article.content_source}</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right font-medium text-slate-200">{article.views.toLocaleString()}</td>
                          <td className="py-2 px-4 flex gap-2">
                            <button
                              onClick={() => handleEdit(article)}
                              className="text-indigo-400 hover:text-indigo-300 text-sm"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteArticle(article)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-3">
                    <button
                      onClick={() => setArticlePages({ ...articlePages, [key]: Math.max(1, currentPage - 1) })}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
                    >
                      上一页
                    </button>
                    <span className="text-sm text-slate-400">
                      第 {currentPage} / {totalPages} 页
                    </span>
                    <button
                      onClick={() => setArticlePages({ ...articlePages, [key]: Math.min(totalPages, currentPage + 1) })}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(!allArticleDetails || Object.keys(allArticlesForTable).length === 0) && (
        <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700/50">
          <p className="text-slate-400">
            暂无文章详情数据。<br />
            请在 <a href="/admin" className="text-indigo-400 hover:underline">管理后台</a> 的「文章详情」中录入文章数据。
          </p>
        </div>
      )}
    </div>
  );
}

function exportPlatformArticles(key: string, name: string, articles: any[]) {
  if (!articles || articles.length === 0) return;
  const rows = articles.map((a: any) => ({
    平台: key,
    日期: a.date,
    标题: a.article_title,
    链接: a.article_url || '',
    阅读量: a.views,
    分类: a.content_category || '',
    来源: a.content_source || '',
  }));
  downloadCSV(rows, `ivorysql-${key}-${name}`);
}

function exportContentData(data: ContentData | null, articleDetails: Record<string, ArticleDetail[]>, period: string) {
  if (!data) return;
  const rows: Record<string, any>[] = [];

  data.articles.forEach(a => {
    rows.push({
      指标: '平台汇总',
      平台: a.platform,
      文章总数: a.article_count,
      总阅读量: a.total_views,
      篇均阅读: a.avg_views,
      粉丝: a.followers,
      点赞: a.likes,
      收藏: a.bookmarks,
      评论: a.comments,
      日期: a.date,
      时间段: period,
    });
  });

  if (articleDetails) {
    Object.entries(articleDetails).forEach(([platform, articles]) => {
      articles.forEach(a => {
        rows.push({
          指标: '文章详情',
          平台: platform,
          日期: a.date,
          标题: a.article_title,
          链接: a.article_url || '',
          阅读: a.views,
          点赞: a.likes,
          评论: a.comments,
          时间段: period,
        });
      });
    });
  }

  downloadCSV(rows, `ivorysql-content-${period.replace(/[~ ]/g, '_')}`);
}