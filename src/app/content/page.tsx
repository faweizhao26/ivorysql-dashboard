'use client';

import { useEffect, useState } from 'react';
import { StatCard, calculateChange } from '@/components/StatCard';
import { TimeRangeSelector, DateRange, Comparison } from '@/components/TimeRangeSelector';

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
}

interface ArticlesResponse {
  articles: Record<string, ArticleDetail[]>;
}

const contentPlatforms = [
  { key: 'csdn', icon: '🔵', name: 'CSDN' },
  { key: 'juejin', icon: '💎', name: '掘金' },
  { key: 'modb', icon: '🟠', name: '墨天轮' },
  { key: 'oschina', icon: '🟢', name: '开源中国' },
  { key: 'sf', icon: '⚡', name: '思否' },
  { key: 'ctoutiao', icon: '📰', name: '51CTO' },
  { key: 'itpub', icon: '🔷', name: 'ITPUB' },
  { key: 'toutiao', icon: '📱', name: '头条号' },
  { key: 'ifclub', icon: '💬', name: 'IFCLUB' },
  { key: 'zhihu', icon: '❓', name: '知乎' },
  { key: 'cnblogs', icon: '🌐', name: '博客园' },
];

const allArticlePlatforms = [
  { key: 'wechat', icon: '💚', name: '公众号' },
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
        const [contentRes, articlesRes] = await Promise.all([
          fetch(`/api/content?${params}`, { credentials: 'include' }),
          fetch(`/api/articles`, { credentials: 'include' })
        ]);
        
        if (contentRes.ok) {
          const json = await contentRes.json();
          setData(json);
        }
        if (articlesRes.ok) {
          const json = await articlesRes.json();
          setArticleDetails(json);
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
  const allArticleDetails = articleDetails?.articles || {};

  const articleData = allArticlePlatforms.reduce((acc, { key }) => {
    const platformItems = articleDataList.filter(s => s.platform === key);
    const latest = platformItems[platformItems.length - 1];
    acc[key] = latest;
    return acc;
  }, {} as Record<string, any>);

  const platformDetailsFromArticles = allArticlePlatforms.reduce((acc, { key }) => {
    const articles = allArticleDetails[key] || [];
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
    const articles = allArticleDetails[key] || [];
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
        {displayDate && (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30">
            📅 存档数据: {displayDate}
          </span>
        )}
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
          {allArticlePlatforms.map(({ key, icon, name }) => {
            const current = articleData[key];
            const articles = allArticleDetails[key] || [];
            const platformArticleCount = articles.length;
            const platformTotalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
            const platformAvgViews = platformArticleCount > 0 ? Math.round(platformTotalViews / platformArticleCount) : 0;
            const platformLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0);
            const platformComments = articles.reduce((sum, a) => sum + (a.comments || 0), 0);
            const hasData = platformArticleCount > 0 || current?.followers;

            if (!hasData) {
              return (
                <div key={key} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 opacity-60">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{icon}</span>
                    <span className="font-medium text-slate-200">{name}</span>
                  </div>
                  <div className="text-sm text-slate-500">暂无数据</div>
                </div>
              );
            }

            return (
              <div key={key} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{icon}</span>
                  <span className="font-medium text-slate-200">{name}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">文章数</span>
                    <span className="font-medium text-slate-200">{platformArticleCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">总阅读量</span>
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

      {Object.keys(allArticleDetails).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">文章详情列表</h2>

          {allArticlePlatforms.map(({ key, icon, name }) => {
            const articles = allArticleDetails[key];
            if (!articles || articles.length === 0) return null;

            const currentPage = articlePages[key] || 1;
            const totalPages = Math.ceil(articles.length / ARTICLES_PER_PAGE);
            const displayedArticles = articles.slice((currentPage - 1) * ARTICLES_PER_PAGE, currentPage * ARTICLES_PER_PAGE);

            return (
              <div key={key} className="mb-6">
                <h3 className="text-base font-medium text-slate-200 mb-3 flex items-center gap-2">
                  <span>{icon}</span>
                  <span>{name}</span>
                  <span className="text-sm text-slate-400">({articles.length} 篇)</span>
                </h3>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-700">
                        <th className="text-left py-3 px-4 font-medium text-slate-400">日期</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-400">文章标题</th>
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

      {(!allArticleDetails || Object.keys(allArticleDetails).length === 0) && (
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