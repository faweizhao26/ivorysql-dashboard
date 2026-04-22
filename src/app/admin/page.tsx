'use client';

import { useEffect, useState } from 'react';

type DataCategory = 'social' | 'article' | 'website' | 'activity';
type TabType = 'manual' | 'articles' | 'reminders' | 'events';

interface DataEntry {
  id?: number;
  date: string;
  category: string;
  metric: string;
  value: number;
  notes?: string;
}

interface ArticleEntry {
  id?: number;
  date: string;
  platform: string;
  article_title: string;
  article_url?: string;
  views: number;
  likes: number;
  comments: number;
}

interface ReminderSetting {
  platform: string;
  update_frequency_days: number;
  reminder_enabled: number;
  webhook_url?: string;
  last_data_updated?: string;
  last_reminder_sent?: string;
}

interface StalePlatform {
  platform: string;
  daysSinceUpdate: number;
  updateFrequency: number;
}

const platforms = {
  social: [
    { value: 'wechat', label: '公众号' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'bilibili', label: 'B站' },
    { value: 'youtube', label: 'YouTube' },
  ],
  article: [
    { value: 'csdn', label: 'CSDN' },
    { value: 'juejin', label: '掘金' },
    { value: 'modb', label: '墨天轮' },
    { value: 'oschina', label: '开源中国' },
    { value: 'sf', label: '思否' },
    { value: 'ctoutiao', label: '51CTO' },
    { value: 'itpub', label: 'ITPUB' },
    { value: 'toutiao', label: '头条号' },
    { value: 'ifclub', label: 'IFCLUB' },
  ],
  website: [
    { value: 'google_analytics', label: 'Google Analytics' },
  ],
  activity: [
    { value: 'conference', label: '技术大会' },
    { value: 'meetup', label: '线下活动' },
    { value: 'webinar', label: '线上活动' },
  ],
};

const metricsByCategory = {
  social: [
    { value: 'followers', label: '粉丝数' },
    { value: 'posts', label: '发帖数' },
    { value: 'views', label: '阅读/播放量' },
    { value: 'likes', label: '点赞数' },
    { value: 'shares', label: '分享数' },
    { value: 'comments', label: '评论数' },
  ],
  article: [
    { value: 'followers', label: '粉丝数' },
    { value: 'article_count', label: '文章总数' },
    { value: 'total_views', label: '总阅读量' },
    { value: 'avg_views', label: '篇均阅读量' },
    { value: 'new_articles', label: '本月新增文章' },
    { value: 'likes', label: '点赞数' },
    { value: 'bookmarks', label: '收藏数' },
  ],
  website: [
    { value: 'pageviews', label: '页面访问量 (PV)' },
    { value: 'unique_visitors', label: '独立访客 (UV)' },
  ],
  activity: [
    { value: 'registrations', label: '报名人数' },
    { value: 'participants', label: '实际参与人数' },
  ],
};

const articlePlatforms = [
  { value: 'wechat', label: '公众号' },
  { value: 'csdn', label: 'CSDN' },
  { value: 'juejin', label: '掘金' },
  { value: 'modb', label: '墨天轮' },
  { value: 'oschina', label: '开源中国' },
  { value: 'sf', label: '思否' },
  { value: 'ctoutiao', label: '51CTO' },
  { value: 'itpub', label: 'ITPUB' },
  { value: 'toutiao', label: '头条号' },
  { value: 'ifclub', label: 'IFCLUB' },
  { value: 'zhihu', label: '知乎' },
  { value: 'cnblogs', label: '博客园' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [stalePlatforms, setStalePlatforms] = useState<StalePlatform[]>([]);
  const [hasStaleData, setHasStaleData] = useState(false);

  useEffect(() => {
    fetchReminderStatus();
  }, []);

  async function fetchReminderStatus() {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setStalePlatforms(data.stalePlatforms || []);
        setHasStaleData(data.hasStaleData || false);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚙️</span>
        <h1 className="text-2xl font-bold text-slate-100">数据管理后台</h1>
      </div>

      {hasStaleData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-400">数据更新提醒</h3>
              <p className="text-sm text-amber-300/80 mt-1">
                以下平台的数据已经超过设定时间未更新：
              </p>
              <ul className="mt-2 space-y-1">
                {stalePlatforms.map(p => (
                  <li key={p.platform} className="text-sm text-amber-300/80">
                    • {p.platform} - 已 {p.daysSinceUpdate} 天未更新（建议 {p.updateFrequency} 天内更新）
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="border-b border-slate-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'manual'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              手动录入
            </button>
            <button
              onClick={() => setActiveTab('articles')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'articles'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              文章详情
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'reminders'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              提醒设置
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'events'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              活动管理
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'manual' && <ManualDataSection />}
          {activeTab === 'articles' && <ArticleSection onDataChange={fetchReminderStatus} />}
          {activeTab === 'reminders' && <ReminderSection onSettingsChange={fetchReminderStatus} />}
          {activeTab === 'events' && <EventsSection />}
        </div>
      </div>
    </div>
  );
}

function ManualDataSection() {
  const [category, setCategory] = useState<DataCategory>('social');
  const [platform, setPlatform] = useState('wechat');
  const [metric, setMetric] = useState('followers');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [records, setRecords] = useState<DataEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [category]);

  useEffect(() => {
    setMetric(metricsByCategory[category][0]?.value || '');
  }, [category]);

  async function fetchRecords() {
    try {
      const res = await fetch(`/api/manual?category=${category}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          category,
          platform,
          metric,
          value: parseFloat(value),
          notes
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      setMessage({ type: 'success', text: '数据保存成功！' });
      setValue('');
      setNotes('');
      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">录入新数据</h2>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">数据类型</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DataCategory)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="social">社交媒体</option>
                <option value="article">内容平台</option>
                <option value="website">官网数据</option>
                <option value="activity">活动数据</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">平台</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {(platforms[category] || []).map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">指标</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {(metricsByCategory[category] || []).map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">数值</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="输入数值"
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">备注</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="可选备注"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存数据'}
          </button>
        </form>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">最近录入数据</h2>

        {records.length === 0 ? (
          <div className="text-slate-500 text-center py-8">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 font-medium text-slate-400">日期</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-400">平台</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-400">指标</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-400">数值</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-400">备注</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((record, index) => (
                  <tr key={index} className="border-b border-slate-700/50">
                    <td className="py-2 px-3 text-slate-300">{record.date}</td>
                    <td className="py-2 px-3 text-slate-300">{record.category}</td>
                    <td className="py-2 px-3 text-slate-300">{record.metric}</td>
                    <td className="py-2 px-3 text-right font-medium text-slate-200">{record.value.toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-500">{record.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleSection({ onDataChange }: { onDataChange: () => void }) {
  const [platform, setPlatform] = useState('wechat');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [articles, setArticles] = useState<ArticleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [editingArticle, setEditingArticle] = useState<ArticleEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const ARTICLES_PER_PAGE = 5;

  useEffect(() => {
    fetchArticles();
    setPage(1);
  }, [platform]);

  async function fetchArticles() {
    try {
      const res = await fetch(`/api/articles?platform=${platform}&all=true`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isEditing && editingArticle?.id) {
        const res = await fetch('/api/articles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingArticle.id,
            date,
            platform,
            article_title: articleTitle,
            article_url: articleUrl,
            views: parseInt(views) || 0,
            likes: parseInt(likes) || 0,
            comments: parseInt(comments) || 0
          })
        });
        if (!res.ok) throw new Error('Failed to update');
        setMessage({ type: 'success', text: '文章更新成功！' });
      } else {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            platform,
            article_title: articleTitle,
            article_url: articleUrl,
            views: parseInt(views) || 0,
            likes: parseInt(likes) || 0,
            comments: parseInt(comments) || 0
          })
        });
        if (!res.ok) throw new Error('Failed to save');
        setMessage({ type: 'success', text: '文章数据保存成功！' });
      }

      resetForm();
      fetchArticles();
      onDataChange();
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setArticleTitle('');
    setArticleUrl('');
    setViews('');
    setLikes('');
    setComments('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsEditing(false);
    setEditingArticle(null);
  }

  function handleEdit(article: ArticleEntry) {
    setEditingArticle(article);
    setIsEditing(true);
    setDate(article.date);
    setArticleTitle(article.article_title);
    setArticleUrl(article.article_url || '');
    setViews(article.views.toString());
    setLikes(article.likes.toString());
    setComments(article.comments.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    resetForm();
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这篇文章吗？')) return;
    
    try {
      const res = await fetch(`/api/articles?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchArticles();
        onDataChange();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const totalPages = Math.ceil(articles.length / ARTICLES_PER_PAGE);
  const displayedArticles = articles.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);
  const platformLabel = articlePlatforms.find(p => p.value === platform)?.label || platform;

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? `编辑文章 - ${platformLabel}` : '录入文章数据'}
            </h2>
            <p className="text-sm text-gray-500">
              {isEditing ? '修改文章信息后保存' : '每篇文章需要单独录入，包括标题、链接和阅读量。公众号数据每周手动更新一次。'}
            </p>
          </div>
          {isEditing && (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              取消编辑
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平台</label>
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setIsEditing(false);
                }}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {articlePlatforms.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">文章标题</label>
              <input
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="输入文章标题"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">文章链接</label>
              <input
                type="url"
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">阅读量</label>
              <input
                type="number"
                value={views}
                onChange={(e) => setViews(e.target.value)}
                placeholder="阅读量"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">点赞数</label>
              <input
                type="number"
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                placeholder="点赞数"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">评论数</label>
              <input
                type="number"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="评论数"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : (isEditing ? '更新文章' : '保存文章')}
          </button>
        </form>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {platformLabel} 文章列表
            <span className="ml-2 text-sm font-normal text-gray-500">
              (共 {articles.length} 篇)
            </span>
          </h2>
          <a 
            href={`/content?platform=${platform}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            查看详情 →
          </a>
        </div>

        {articles.length === 0 ? (
          <div className="text-gray-400 text-center py-8">暂无文章数据</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">日期</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">标题</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">阅读</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">点赞</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">评论</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedArticles.map((article, index) => (
                    <tr key={article.id || index} className="border-b border-gray-100 hover:bg-gray-100">
                      <td className="py-2 px-3">{article.date}</td>
                      <td className="py-2 px-3 max-w-xs truncate">
                        {article.article_url ? (
                          <a 
                            href={article.article_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                            title={article.article_title}
                          >
                            {article.article_title}
                          </a>
                        ) : (
                          <span className="text-gray-900" title={article.article_title}>
                            {article.article_title}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{article.views.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{article.likes.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{article.comments.toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => handleEdit(article)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => article.id && handleDelete(article.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
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
              <div className="flex justify-center items-center gap-2 mt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-600">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReminderSection({ onSettingsChange }: { onSettingsChange: () => void }) {
  const [settings, setSettings] = useState<ReminderSetting[]>([]);
  const [platform, setPlatform] = useState('wechat');
  const [updateFrequency, setUpdateFrequency] = useState(7);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          update_frequency_days: updateFrequency,
          reminder_enabled: reminderEnabled,
          webhook_url: webhookUrl
        })
      });

      if (!res.ok) throw new Error('Failed to save');
      setMessage({ type: 'success', text: '设置保存成功！' });
      fetchSettings();
      onSettingsChange();
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
  }

  async function sendReminder(platform: string) {
    if (!confirm(`确定向 ${platform} 发送提醒吗？`)) return;

    try {
      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          action: 'send_reminder'
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert('提醒发送成功！');
      } else {
        alert(data.error || '发送失败');
      }
    } catch (err) {
      alert('发送失败，请重试');
    }
  }

  function loadSettings(setting: ReminderSetting) {
    setPlatform(setting.platform);
    setUpdateFrequency(setting.update_frequency_days);
    setReminderEnabled(setting.reminder_enabled === 1);
    setWebhookUrl(setting.webhook_url || '');
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">提醒设置</h2>
        <p className="text-sm text-gray-500 mb-4">
          设置各平台的数据更新频率和提醒方式。当数据超过设定时间未更新时，会在后台首页显示警告。
          支持配置 Discord/Slack Webhook 来发送自动提醒。
        </p>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平台</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[...articlePlatforms, ...platforms.social.map(p => ({ value: p.value, label: p.label }))].map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">更新频率（天）</label>
              <input
                type="number"
                value={updateFrequency}
                onChange={(e) => setUpdateFrequency(parseInt(e.target.value) || 7)}
                min={1}
                max={365}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/... 或 Slack webhook URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">启用提醒</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : '保存设置'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">已配置的平台</h2>

        {settings.length === 0 ? (
          <div className="text-gray-400 text-center py-8">暂无配置</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">平台</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">更新频率</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">上次更新</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">上次提醒</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">状态</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium">{setting.platform}</td>
                    <td className="py-2 px-3 text-right">{setting.update_frequency_days} 天</td>
                    <td className="py-2 px-3">
                      {setting.last_data_updated 
                        ? new Date(setting.last_data_updated).toLocaleDateString('zh-CN')
                        : '从未更新'}
                    </td>
                    <td className="py-2 px-3">
                      {setting.last_reminder_sent 
                        ? new Date(setting.last_reminder_sent).toLocaleDateString('zh-CN')
                        : '从未提醒'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        setting.reminder_enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {setting.reminder_enabled ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => loadSettings(setting)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => sendReminder(setting.platform)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        disabled={!setting.webhook_url}
                        title={setting.webhook_url ? '发送提醒' : '需要配置 Webhook URL'}
                      >
                        发送提醒
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-2">💡 如何配置 Webhook 提醒？</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>Discord:</strong> 服务器设置 → 集成 → Webhook → 新建 Webhook → 复制 URL</p>
          <p><strong>Slack:</strong> Slack App → Incoming Webhooks → 添加新 Webhook → 选择频道 → 复制 URL</p>
          <p className="mt-2">配置 Webhook 后，系统会在数据超过设定时间未更新时自动发送提醒。</p>
        </div>
      </div>
    </div>
  );
}

interface ActivityEvent {
  id?: number;
  event_name: string;
  event_date: string;
  event_type: string;
  location?: string;
  venue?: string;
  participants: number;
  registrations: number;
  online_viewers: number;
  collected_data: Record<string, any>;
  description?: string;
  url?: string;
}

const eventTypeOptions = [
  { value: 'conference', label: '技术大会' },
  { value: 'meetup', label: '线下聚会' },
  { value: 'webinar', label: '线上直播' },
  { value: 'workshop', label: '工作坊' },
  { value: 'hackathon', label: '黑客马拉松' },
  { value: 'other', label: '其他' },
];

function EventsSection() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<ActivityEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventType, setEventType] = useState('conference');
  const [location, setLocation] = useState('');
  const [venue, setVenue] = useState('');
  const [participants, setParticipants] = useState('');
  const [registrations, setRegistrations] = useState('');
  const [onlineViewers, setOnlineViewers] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function resetForm() {
    setEventName('');
    setEventDate(new Date().toISOString().split('T')[0]);
    setEventType('conference');
    setLocation('');
    setVenue('');
    setParticipants('');
    setRegistrations('');
    setOnlineViewers('');
    setDescription('');
    setUrl('');
    setIsEditing(false);
    setEditingEvent(null);
  }

  function handleEdit(event: ActivityEvent) {
    setEditingEvent(event);
    setIsEditing(true);
    setEventName(event.event_name);
    setEventDate(event.event_date);
    setEventType(event.event_type);
    setLocation(event.location || '');
    setVenue(event.venue || '');
    setParticipants(event.participants?.toString() || '');
    setRegistrations(event.registrations?.toString() || '');
    setOnlineViewers(event.online_viewers?.toString() || '');
    setDescription(event.description || '');
    setUrl(event.url || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        event_name: eventName,
        event_date: eventDate,
        event_type: eventType,
        location,
        venue,
        participants: parseInt(participants) || 0,
        registrations: parseInt(registrations) || 0,
        online_viewers: parseInt(onlineViewers) || 0,
        description,
        url,
        collected_data: {}
      };

      const res = isEditing && editingEvent?.id
        ? await fetch('/api/events', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingEvent.id, ...payload })
          })
        : await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      if (!res.ok) throw new Error('Failed to save');
      setMessage({ type: 'success', text: isEditing ? '活动更新成功！' : '活动创建成功！' });
      resetForm();
      fetchEvents();
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这个活动吗？')) return;

    try {
      const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEvents();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? '编辑活动' : '创建新活动'}
            </h2>
            <p className="text-sm text-gray-500">
              {isEditing ? '修改活动信息后保存' : '录入活动基本信息，包括名称、日期、类型和地点等。'}
            </p>
          </div>
          {isEditing && (
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              取消编辑
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">活动名称</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="输入活动名称"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">活动类型</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {eventTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地点</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="城市或线上"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">场馆</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="具体场馆名称"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">报名人数</label>
              <input
                type="number"
                value={registrations}
                onChange={(e) => setRegistrations(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">参与人数</label>
              <input
                type="number"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">线上观看人数</label>
              <input
                type="number"
                value={onlineViewers}
                onChange={(e) => setOnlineViewers(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">活动链接</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">活动描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述活动内容..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : (isEditing ? '更新活动' : '创建活动')}
          </button>
        </form>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          活动列表
          <span className="ml-2 text-sm font-normal text-gray-500">
            (共 {events.length} 个)
          </span>
        </h2>

        {events.length === 0 ? (
          <div className="text-gray-400 text-center py-8">暂无活动数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">日期</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">活动名称</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">类型</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">地点</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">报名</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">参与</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-3 text-slate-300">{event.event_date}</td>
                    <td className="py-2 px-3 max-w-xs truncate text-slate-200" title={event.event_name}>
                      {event.event_name}
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {eventTypeOptions.find(t => t.value === event.event_type)?.label || event.event_type}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{event.location || '-'}</td>
                    <td className="py-2 px-3 text-right text-slate-200">{event.registrations || 0}</td>
                    <td className="py-2 px-3 text-right text-slate-200">{event.participants || 0}</td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => handleEdit(event)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => event.id && handleDelete(event.id)}
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
        )}
      </div>
    </div>
  );
}