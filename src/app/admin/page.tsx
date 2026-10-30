'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBeijingDate } from '@/lib/date';
import SyncStatusPanel from '@/components/admin/SyncStatusPanel';
import EventManager from '@/components/admin/EventManager';
import EvangelistAvatar from '@/components/EvangelistAvatar';
import EvangelistAvatarPicker from '@/components/admin/EvangelistAvatarPicker';
import { getAvailableEvangelistAvatar, getEvangelistAvatar } from '@/lib/evangelist-avatar';
import { formatArticleMetric } from '@/lib/content-values.mjs';
import { getManualSelection, isDataCategory, MAX_STATS_VALUE, metricsByCategory, platforms } from '@/lib/manual-data';
import { EVANGELIST_CATEGORIES, EVANGELIST_RULES_VERSION, evangelistContributionTypes, evangelistContributionLimits, getEvangelistRule, getContributionBudget, getArticleKey, mapLegacyContribution, isHistoricalScorePreserved } from '@/lib/evangelist-rules';
export { evangelistContributionTypes, evangelistContributionLimits } from '@/lib/evangelist-rules';

type TabType = 'manual' | 'articles' | 'reminders' | 'sync' | 'events' | 'evangelist';

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
  views: number | null;
  likes: number | null;
  comments: number | null;
  content_category?: string;
  content_source?: string;
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

  const fetchReminderStatus = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reminders', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data || controller.signal.aborted) return;
        setStalePlatforms(data.stalePlatforms || []);
        setHasStaleData(data.hasStaleData || false);
      })
      .catch(error => { if (!controller.signal.aborted) console.error(error); });
    return () => controller.abort();
  }, []);

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
          <nav className="flex -mb-px overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap">
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
              onClick={() => setActiveTab('sync')}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'sync'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              同步状态
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
            <button
              onClick={() => setActiveTab('evangelist')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'evangelist'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              布道者计划
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'manual' && <ManualDataSection />}
          {activeTab === 'articles' && <ArticleSection onDataChange={fetchReminderStatus} />}
          {activeTab === 'reminders' && <ReminderSection onSettingsChange={fetchReminderStatus} />}
          {activeTab === 'sync' && <SyncStatusPanel />}
          {activeTab === 'events' && <EventManager />}
          {activeTab === 'evangelist' && <EvangelistSection />}
        </div>
      </div>
    </div>
  );
}

function ManualDataSection() {
  const [selection, setSelection] = useState(() => getManualSelection('social'));
  const { category, platform, metric } = selection;
  const [date, setDate] = useState(getBeijingDate);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [records, setRecords] = useState<DataEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/manual?category=${category}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error(err);
    }
  }, [category]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
          value: Number(value),
          notes
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      setMessage({ type: 'success', text: '数据保存成功！' });
      setValue('');
      setNotes('');
      fetchRecords();
    } catch {
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
                onChange={(e) => {
                  if (isDataCategory(e.target.value)) setSelection(getManualSelection(e.target.value));
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="social">社交媒体</option>
                <option value="article">内容平台</option>
                <option value="activity">活动数据</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">平台</label>
              <select
                value={platform}
                onChange={(e) => setSelection({ ...selection, platform: e.target.value })}
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
                onChange={(e) => setSelection({ ...selection, metric: e.target.value })}
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
                min={0}
                step={1}
                max={category === 'activity' ? Number.MAX_SAFE_INTEGER : MAX_STATS_VALUE}
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
  const [date, setDate] = useState(getBeijingDate);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [contentCategory, setContentCategory] = useState('');
  const [contentSource, setContentSource] = useState('');
  const [articles, setArticles] = useState<ArticleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [editingArticle, setEditingArticle] = useState<ArticleEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const ARTICLES_PER_PAGE = 5;

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles?platform=${platform}&all=true`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [platform]);

  useEffect(() => {
    fetchArticles();
    setPage(1);
  }, [fetchArticles]);

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
            views: views.trim() === '' ? undefined : views,
            likes: likes.trim() === '' ? undefined : likes,
            comments: comments.trim() === '' ? undefined : comments,
            content_category: contentCategory || null,
            content_source: contentSource || null
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || '文章更新失败，请重试');
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
            views: views.trim() === '' ? 0 : views,
            likes: likes.trim() === '' ? 0 : likes,
            comments: comments.trim() === '' ? 0 : comments,
            content_category: contentCategory || null,
            content_source: contentSource || null
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || '文章保存失败，请重试');
        setMessage({ type: 'success', text: '文章数据保存成功！' });
      }

      resetForm();
      fetchArticles();
      onDataChange();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败，请重试' });
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
    setContentCategory('');
    setContentSource('');
    setDate(getBeijingDate());
    setIsEditing(false);
    setEditingArticle(null);
  }

  function handleEdit(article: ArticleEntry) {
    setEditingArticle(article);
    setIsEditing(true);
    setDate(article.date);
    setArticleTitle(article.article_title);
    setArticleUrl(article.article_url || '');
    setViews(article.views?.toString() ?? '');
    setLikes(article.likes?.toString() ?? '');
    setComments(article.comments?.toString() ?? '');
    setContentCategory(article.content_category || '');
    setContentSource(article.content_source || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    resetForm();
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这篇文章吗？')) return;
    
    try {
      const res = await fetch(`/api/articles?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || '文章删除失败，请重试');
      fetchArticles();
      onDataChange();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '文章删除失败，请重试' });
    }
  }

  const totalPages = Math.ceil(articles.length / ARTICLES_PER_PAGE);
  const displayedArticles = articles.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);
  const platformLabel = articlePlatforms.find(p => p.value === platform)?.label || platform;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {isEditing ? `编辑文章 - ${platformLabel}` : '录入文章数据'}
            </h2>
            <p className="text-sm text-slate-400">
              {isEditing ? '修改文章信息后保存' : '每篇文章需要单独录入，包括标题、链接和阅读量。公众号数据每周手动更新一次。'}
            </p>
          </div>
          {isEditing && (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700/30"
            >
              取消编辑
            </button>
          )}
        </div>

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
              <label className="block text-sm font-medium text-slate-300 mb-1">平台</label>
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setIsEditing(false);
                }}
                disabled={isEditing}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-800 disabled:cursor-not-allowed"
              >
                {articlePlatforms.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">文章标题</label>
              <input
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="输入文章标题"
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">文章链接</label>
              <input
                type="url"
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">阅读量</label>
              <input
                type="number"
                value={views}
                onChange={(e) => setViews(e.target.value)}
                min="0"
                max="2147483647"
                step="1"
                placeholder="阅读量"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">内容分类</label>
              <select value={contentCategory} onChange={(e) => setContentCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
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
              <select value={contentSource} onChange={(e) => setContentSource(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
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

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : (isEditing ? '更新文章' : '保存文章')}
          </button>
        </form>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {platformLabel} 文章列表
            <span className="ml-2 text-sm font-normal text-slate-400">
              (共 {articles.length} 篇)
            </span>
          </h2>
          <a 
            href={`/content?platform=${platform}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            查看详情 →
          </a>
        </div>

        {articles.length === 0 ? (
          <div className="text-slate-500 text-center py-8">暂无文章数据</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 font-medium text-slate-400">日期</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-400">标题</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-400">阅读</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-400">分类</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-400">来源</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedArticles.map((article, index) => (
                    <tr key={article.id || index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3">{article.date}</td>
                      <td className="py-2 px-3 max-w-xs truncate">
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
                          <span className="text-slate-100" title={article.article_title}>
                            {article.article_title}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{formatArticleMetric(article.views)}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{article.content_category || '-'}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{article.content_source || '-'}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => handleEdit(article)}
                          className="text-indigo-400 hover:text-indigo-300 text-sm mr-3"
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
                  className="px-3 py-1 text-sm bg-slate-800 border border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/30"
                >
                  上一页
                </button>
                <span className="text-sm text-slate-400">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm bg-slate-800 border border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/30"
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
    } catch {
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
    } catch {
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
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">提醒设置</h2>
        <p className="text-sm text-slate-400 mb-4">
          设置各平台的数据更新频率和提醒方式。当数据超过设定时间未更新时，会在后台首页显示警告。
          支持配置 Discord/Slack Webhook 来发送自动提醒。
        </p>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">平台</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[...articlePlatforms, ...platforms.social.map(p => ({ value: p.value, label: p.label }))].map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">更新频率（天）</label>
              <input
                type="number"
                value={updateFrequency}
                onChange={(e) => setUpdateFrequency(parseInt(e.target.value) || 7)}
                min={1}
                max={365}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Webhook URL</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/... 或 Slack webhook URL"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              <span className="text-sm font-medium text-slate-300">启用提醒</span>
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

      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">已配置的平台</h2>

        {settings.length === 0 ? (
          <div className="text-slate-500 text-center py-8">暂无配置</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 font-medium text-slate-400">平台</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-400">更新频率</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-400">上次更新</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-400">上次提醒</th>
                  <th className="text-center py-2 px-3 font-medium text-slate-400">状态</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting, index) => (
                  <tr key={index} className="border-b border-slate-700/50">
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
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {setting.reminder_enabled ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => loadSettings(setting)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => sendReminder(setting.platform)}
                        className="text-blue-600 hover:text-blue-400 text-sm"
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

      <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/30">
        <h3 className="font-semibold text-blue-400 mb-2">💡 如何配置 Webhook 提醒？</h3>
        <div className="text-sm text-blue-300 space-y-2">
          <p><strong>Discord:</strong> 服务器设置 → 集成 → Webhook → 新建 Webhook → 复制 URL</p>
          <p><strong>Slack:</strong> Slack App → Incoming Webhooks → 添加新 Webhook → 选择频道 → 复制 URL</p>
          <p className="mt-2">配置 Webhook 后，系统会在数据超过设定时间未更新时自动发送提醒。</p>
        </div>
      </div>
    </div>
  );
}


interface ContributionLimitRecord {
  id?: number;
  type?: string;
  points?: number;
  date?: string | null;
}

interface ContributionLimitStatus {
  currentPoints: number;
  draftPoints: number;
  projectedPoints: number;
  limit: number;
  exceededBy: number;
}

interface EvangelistContributionRecord extends ContributionLimitRecord {
  participant_id: number;
  category?: string;
  title?: string;
  url?: string;
  notes?: string;
  rules_version?: string;
  article_key?: string | null;
}

interface EvangelistParticipantDraft {
  id?: number;
  name: string;
  avatar_url?: string | null;
  title?: string | null;
  bio?: string | null;
  joined_date?: string | null;
}

interface EvangelistParticipant extends EvangelistParticipantDraft {
  id: number;
  total_points?: number | string;
}

interface SavedEvangelistContribution extends EvangelistContributionRecord {
  id: number;
}

export function calculateEvangelistContributionLimit(
  contributions: ContributionLimitRecord[],
  draft: ContributionLimitRecord,
  year = Number(getBeijingDate().slice(0, 4))
): ContributionLimitStatus | null {
  const limit = draft.type ? evangelistContributionLimits[draft.type] : undefined;
  const yearPrefix = `${year}-`;

  if (!limit || (draft.date && !draft.date.startsWith(yearPrefix))) return null;

  const currentPoints = contributions.reduce((total, contribution) => {
    const isCurrentRecord = draft.id !== undefined && contribution.id === draft.id;
    const isSameType = getEvangelistRule(contribution.type)?.name === getEvangelistRule(draft.type)?.name;
    const isInPlanYear = !contribution.date || contribution.date.startsWith(yearPrefix);
    return isCurrentRecord || !isSameType || !isInPlanYear
      ? total
      : total + (Number(contribution.points) || 0);
  }, 0);
  const draftPoints = Number(draft.points) || 0;
  const projectedPoints = currentPoints + draftPoints;

  return {
    currentPoints,
    draftPoints,
    projectedPoints,
    limit,
    exceededBy: Math.max(0, projectedPoints - limit),
  };
}

function EvangelistSection() {
  const [participants, setParticipants] = useState<EvangelistParticipant[]>([]);
  const [editingPerson, setEditingPerson] = useState<EvangelistParticipantDraft | null>(null);
  const [editingCont, setEditingCont] = useState<EvangelistContributionRecord | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contributions, setContributions] = useState<SavedEvangelistContribution[]>([]);
  const [contributionParticipantId, setContributionParticipantId] = useState<number | null>(null);
  const [loadingContributions, setLoadingContributions] = useState(false);
  const [savingPerson, setSavingPerson] = useState(false);
  const [savingContribution, setSavingContribution] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'form' | 'history'>('form');
  const savingPersonRef = useRef(false);
  const savingContributionRef = useRef(false);
  const contributionRequestRef = useRef(0);
  const personFormRef = useRef<HTMLDivElement>(null);

  function openPerson(person?: EvangelistParticipant) {
    setEditingPerson(person ? { ...person, avatar_url: getEvangelistAvatar(person.id, person.avatar_url).url } : { name: '', title: '', bio: '', avatar_url: getAvailableEvangelistAvatar(participants) });
    requestAnimationFrame(() => personFormRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  useEffect(() => { fetchParticipants(); }, []);

  const isContributionDrawerOpen = editingCont !== null;
  const activeParticipantName = participants.find(
    participant => participant.id === editingCont?.participant_id
  )?.name || '未选择成员';
  const contributionBudget = editingCont ? getContributionBudget(contributions, editingCont) : null;
  const selectedRule = getEvangelistRule(editingCont?.type);
  const historicalPointsKept = editingCont ? isHistoricalScorePreserved(editingCont, contributions.find(row => row.id === editingCont.id)) : false;
  const contributionHistoryReady = !loadingContributions && contributionParticipantId === editingCont?.participant_id;
  const articleGroups = Array.from(new Map(contributions.filter(row => row.id !== editingCont?.id && getEvangelistRule(row.type)?.articlePath && getArticleKey(row)).map(row => [getArticleKey(row), row])).entries());

  function closeContributionDrawer() {
    setEditingCont(null);
    setDrawerTab('form');
  }

  useEffect(() => {
    if (!isContributionDrawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditingCont(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isContributionDrawerOpen]);

  async function fetchParticipants() {
    const res = await fetch('/api/evangelist', { credentials: 'include' });
    if (res.ok) setParticipants(await res.json());
  }

  async function fetchContributions(pid: number) {
    const requestId = ++contributionRequestRef.current;
    setSelectedId(pid);
    setContributionParticipantId(pid);
    setContributions([]);
    setLoadingContributions(true);

    try {
      const res = await fetch('/api/evangelist?participant_id=' + pid, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (requestId === contributionRequestRef.current) {
          setContributions((data.contributions || []).map(mapLegacyContribution));
        }
      }
    } finally {
      if (requestId === contributionRequestRef.current) {
        setLoadingContributions(false);
      }
    }
  }

  function clearContributionSelection() {
    contributionRequestRef.current += 1;
    setSelectedId(null);
    setContributionParticipantId(null);
    setContributions([]);
    setLoadingContributions(false);
  }

  function openNewContribution(participantId: number) {
    setDrawerTab('form');
    setEditingCont({ participant_id: participantId, category:'', type:'', title:'', url:'', points:0, date:getBeijingDate(), notes:'', rules_version: EVANGELIST_RULES_VERSION });
    void fetchContributions(participantId);
  }

  function openExistingContribution(contribution: EvangelistContributionRecord) {
    setSelectedId(contribution.participant_id);
    setDrawerTab('form');
    setEditingCont(contribution);
    if (contributionParticipantId !== contribution.participant_id) {
      void fetchContributions(contribution.participant_id);
    }
  }

  async function savePerson(e: React.FormEvent) {
    e.preventDefault();
    if (savingPersonRef.current || !editingPerson) return;
    savingPersonRef.current = true;
    setSavingPerson(true);
    try {
      const m = editingPerson.id ? 'PUT' : 'POST';
      const res = await fetch('/api/evangelist', { method: m, headers: {'Content-Type':'application/json'}, body: JSON.stringify(editingPerson), credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '请稍后重试');
      }
      setEditingPerson(null);
      await fetchParticipants().catch(() => alert('保存成功，但成员列表刷新失败，请刷新页面'));
    } catch (error) {
      alert('保存失败: ' + (error instanceof Error ? error.message : '请稍后重试'));
    } finally {
      savingPersonRef.current = false;
      setSavingPerson(false);
    }
  }

  async function saveContribution(e: React.FormEvent) {
    e.preventDefault();
    if (savingContributionRef.current || !editingCont) return;
    if (!editingCont.participant_id) { alert('请先选择成员'); return; }
    if (!editingCont.category || !editingCont.type) { alert('请选择类别和类型'); return; }
    savingContributionRef.current = true;
    setSavingContribution(true);
    try {
      const m = editingCont.id ? 'PUT' : 'POST';
      const res = await fetch('/api/evangelist', { method: m, headers: {'Content-Type':'application/json'}, body: JSON.stringify(editingCont), credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '请稍后重试');
      }
      closeContributionDrawer();
      await Promise.all([
        fetchContributions(editingCont.participant_id),
        fetchParticipants(),
      ]).catch(() => alert('保存成功，但贡献或成员列表刷新失败，请刷新页面'));
    } catch (error) {
      alert('保存失败: ' + (error instanceof Error ? error.message : '请稍后重试'));
    } finally {
      savingContributionRef.current = false;
      setSavingContribution(false);
    }
  }

  async function deletePerson(id: number) {
    if (!confirm('确定删除？')) return;
    try {
      const res = await fetch('/api/evangelist?id=' + id, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '请稍后重试');
      }
      if (selectedId === id) clearContributionSelection();
      if (editingPerson?.id === id) setEditingPerson(null);
      if (editingCont?.participant_id === id) closeContributionDrawer();
      await fetchParticipants().catch(() => alert('删除成功，但成员列表刷新失败，请刷新页面'));
    } catch (error) {
      alert('删除失败: ' + (error instanceof Error ? error.message : '请稍后重试'));
    }
  }

  async function deleteContribution(id: number) { if (!confirm('确定删除？')) return;
    await fetch('/api/evangelist?id=' + id + '&type=contribution', { method: 'DELETE', credentials: 'include' });
    if (selectedId) fetchContributions(selectedId); fetchParticipants(); }

  const categories = EVANGELIST_CATEGORIES;

  // Ensure current value is in options
  function getCategoryOptions() {
    const opts = [...categories];
    if (editingCont?.category && !opts.includes(editingCont.category)) opts.push(editingCont.category);
    return opts;
  }
  function getTypeOptions() {
    const opts = [...(evangelistContributionTypes[editingCont?.category ?? ''] || [])];
    if (editingCont?.id && editingCont.type && !opts.includes(editingCont.type)) opts.push(editingCont.type);
    return opts;
  }

  return (
    <div className="space-y-6">
      {/* Person Form */}
      <div ref={personFormRef} className="scroll-mt-36 bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between mb-2">
          <h2 className="font-semibold text-slate-100">{editingPerson ? (editingPerson.id ? '编辑成员' : '新建成员') : '成员管理'}</h2>
          <div className="flex gap-2">
            {editingPerson && <button onClick={() => setEditingPerson(null)} className="text-sm text-slate-400 hover:bg-slate-700 px-3 py-1 rounded-lg">取消</button>}
            {!editingPerson && <button type="button" onClick={() => openPerson()} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500">+ 新增成员</button>}
          </div>
        </div>
        {!editingPerson ? (
          <p className="text-sm text-slate-500">点击「+ 新增成员」按钮开始添加</p>
        ) : (
        <form onSubmit={savePerson} className="space-y-2">
          <div className="flex items-center gap-3 pb-2">
            <EvangelistAvatar participantId={editingPerson.id || 0} name={editingPerson.name || '新成员'} avatarUrl={editingPerson.avatar_url} size="large" />
            <span className="text-sm text-slate-300">{editingPerson.name || '新成员'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input required placeholder="姓名" value={editingPerson?.name || ''} onChange={e => setEditingPerson({...editingPerson, name: e.target.value})} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 text-sm" />
            <input placeholder="头衔" value={editingPerson?.title || ''} onChange={e => setEditingPerson({...editingPerson, title: e.target.value})} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 text-sm" />
          </div>
          <input placeholder="简介" value={editingPerson?.bio || ''} onChange={e => setEditingPerson({...editingPerson, bio: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 text-sm" />
          <EvangelistAvatarPicker value={editingPerson.avatar_url || ''} onChange={avatar_url => setEditingPerson({ ...editingPerson, avatar_url })} members={participants} participantId={editingPerson.id} />
          <button type="submit" disabled={savingPerson} aria-busy={savingPerson} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{savingPerson ? '保存中...' : editingPerson?.id ? '更新' : '添加'}</button>
        </form>
        )}
      </div>

      {/* Members List */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
        <h2 className="font-semibold text-slate-100 mb-3">成员列表（{participants.length}人）</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-700">
            <th className="text-left py-2 px-2 text-slate-400">姓名</th>
            <th className="text-right py-2 px-2 text-slate-400 w-16">积分</th>
            <th className="text-right py-2 px-2 text-slate-400 w-32">操作</th>
          </tr></thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className={`border-b border-slate-700/50 ${selectedId === p.id ? 'bg-indigo-500/10' : 'hover:bg-slate-700/30'}`}>
                <td className="py-2 px-2">
                  <button onClick={() => { if (selectedId === p.id) { clearContributionSelection(); } else void fetchContributions(p.id); }} className="text-slate-200 hover:text-indigo-400 text-left">
                    <span className="inline-flex items-center gap-2"><EvangelistAvatar participantId={p.id} name={p.name} avatarUrl={p.avatar_url} size="small" />{p.name}</span>
                    {selectedId === p.id && <span className="ml-2 text-xs text-indigo-400">▼</span>}
                  </button>
                </td>
                <td className="py-2 px-2 text-right font-bold text-slate-200">{p.total_points || 0}</td>
                <td className="py-2 px-2 text-right text-xs whitespace-nowrap space-x-0.5">
                  <button onClick={() => openPerson(p)} className="text-indigo-400 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-indigo-500/10">编辑</button>
                  <button onClick={() => deletePerson(p.id)} className="text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10">删除</button>
                  <button onClick={() => openNewContribution(p.id)} className="text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded hover:bg-amber-500/10">+贡献</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contribution Details */}
      {selectedId && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
          <h2 className="font-semibold text-slate-100 mb-3">贡献记录（{contributions.length}条）</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              <th className="text-left py-2 px-2 text-slate-400">日期</th>
              <th className="text-left py-2 px-2 text-slate-400">类别</th>
              <th className="text-left py-2 px-2 text-slate-400">类型</th>
              <th className="text-left py-2 px-2 text-slate-400">标题</th>
              <th className="text-right py-2 px-2 text-slate-400 w-16">积分</th>
              <th className="text-right py-2 px-2 text-slate-400 w-16">操作</th>
            </tr></thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 px-2 text-slate-400">{c.date || '-'}</td>
                  <td className="py-2 px-2 text-slate-300">{c.category}</td>
                  <td className="py-2 px-2 text-slate-300">{c.type}</td>
                  <td className="py-2 px-2 text-slate-200 max-w-xs truncate">
                    {c.url ? <a href={c.url} target="_blank" className="text-indigo-400 hover:underline">{c.title || c.url}</a> : (c.title || '-')}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-slate-200">{c.points}</td>
                  <td className="py-2 px-2 text-right">
                    <button onClick={() => openExistingContribution(c)} className="text-indigo-400 text-xs mr-1">编辑</button>
                    <button onClick={() => deleteContribution(c.id)} className="text-red-400 text-xs">删</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingCont && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="关闭贡献编辑"
            onClick={closeContributionDrawer}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contribution-drawer-title"
            data-contribution-drawer
            className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[960px] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between border-b border-slate-700 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="contribution-drawer-title" className="text-lg font-semibold text-slate-100">
                  {editingCont.id ? '编辑贡献' : '添加贡献'}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-400">当前成员：{activeParticipantName}</p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                title="关闭"
                onClick={closeContributionDrawer}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                ×
              </button>
            </header>

            <div className="grid shrink-0 grid-cols-2 border-b border-slate-700 p-1 md:hidden" role="tablist" aria-label="贡献编辑视图">
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'form'}
                onClick={() => setDrawerTab('form')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${drawerTab === 'form' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                新增贡献
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'history'}
                onClick={() => setDrawerTab('history')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${drawerTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                已有贡献（{contributions.length}）
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
              <aside
                data-contribution-history
                className={`${drawerTab === 'history' ? 'flex' : 'hidden'} min-h-0 flex-col md:flex md:border-r md:border-slate-700`}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-700/80 px-5 py-3">
                  <h3 className="font-medium text-slate-200">已有贡献</h3>
                  <span className="text-xs text-slate-500">{contributions.length} 条</span>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {loadingContributions ? (
                    <div className="py-10 text-center text-sm text-slate-500">正在加载该成员的贡献...</div>
                  ) : contributions.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">该成员暂无贡献记录</div>
                  ) : contributions.map((contribution) => {
                    const isSameType = Boolean(editingCont.type) && contribution.type === editingCont.type;
                    const isCurrentRecord = contribution.id === editingCont.id;
                    return (
                      <article
                        key={contribution.id}
                        data-contribution-history-item
                        className={`rounded-lg border p-3 transition-colors ${isCurrentRecord ? 'border-amber-500/70 bg-amber-500/10' : isSameType ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">{contribution.date || '日期未填写'} · {contribution.category}</div>
                            <div className="mt-1 text-sm font-medium text-slate-200">{contribution.type}</div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-amber-400">+{contribution.points || 0}</span>
                        </div>
                        {contribution.title && <div className="mt-2 break-words text-sm text-slate-300">{contribution.title}</div>}
                        {contribution.notes && <div className="mt-2 break-words border-t border-slate-700/70 pt-2 text-xs text-slate-500">备注：{contribution.notes}</div>}
                        {isCurrentRecord && <div className="mt-2 text-xs font-medium text-amber-400">当前正在编辑</div>}
                      </article>
                    );
                  })}
                </div>
              </aside>

              <form
                data-contribution-form
                onSubmit={saveContribution}
                className={`${drawerTab === 'form' ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}
              >
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-slate-300">
                      <span>贡献类别</span>
                      <select
                        required
                        autoFocus
                        value={editingCont.category || ''}
                        disabled={!contributionHistoryReady}
                        onChange={e => setEditingCont({...editingCont, category: e.target.value, type: '', points: 0, article_key: null})}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200"
                      >
                        <option value="">选择类别</option>
                        {getCategoryOptions().map(c => <option key={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm text-slate-300">
                      <span>贡献类型</span>
                      <select
                        required
                        value={editingCont.type || ''}
                        onChange={e => {
                          const draft = { ...editingCont, type: e.target.value, article_key: null };
                          setEditingCont({ ...draft, points: getContributionBudget(contributions, draft).suggestedPoints });
                        }}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!editingCont.category || !contributionHistoryReady}
                      >
                        <option value="">选择类型</option>
                        {getTypeOptions().map(t => <option key={t} value={t}>{t}{getEvangelistRule(t)?.points != null ? `（${getEvangelistRule(t)?.points} 分）` : ''}</option>)}
                      </select>
                    </label>
                  </div>

                  {selectedRule && <div className="space-y-2 border-l-2 border-indigo-500/60 pl-3 text-sm text-slate-400" data-contribution-budget>
                    <p>{selectedRule.description}</p>
                    {contributionBudget?.limits.map(limit => <p key={limit.scope} className="text-xs">{limit.label}：已计 {limit.currentPoints} / {limit.limit} 分</p>)}
                    {!historicalPointsKept && Number.isFinite(contributionBudget?.availablePoints) && <p className="text-xs text-indigo-300">本次最多可计 {contributionBudget?.availablePoints} 分</p>}
                  </div>}
                  {historicalPointsKept && <p className="text-xs text-amber-300">历史已审核积分保留：{editingCont.points} 分；仅调整分类名称或补充说明，不追溯重算。</p>}
                  {selectedRule?.articlePath && <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>归属文章</span>
                    <select aria-label="归属文章" value={editingCont.article_key || ''} onChange={e => {
                      const draft = { ...editingCont, article_key: e.target.value || null };
                      setEditingCont({ ...draft, points: getContributionBudget(contributions, draft).suggestedPoints });
                    }} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200">
                      <option value="">按本条文章标题归组</option>
                      {editingCont.article_key && !articleGroups.some(([key]) => key === editingCont.article_key) && <option value={editingCont.article_key}>当前文章：{editingCont.title || editingCont.article_key}</option>}
                      {articleGroups.map(([key, article]) => <option key={key} value={key}>{article.title || key}</option>)}
                    </select>
                  </label>}

                  <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>标题 <span className="text-slate-500">{selectedRule?.articlePath && !editingCont.article_key && !historicalPointsKept ? '（必填）' : '（可选）'}</span></span>
                    <input
                      required={!!selectedRule?.articlePath && !editingCont.article_key && !historicalPointsKept}
                      value={editingCont.title || ''}
                      onChange={e => {
                        const draft = { ...editingCont, title: e.target.value };
                        setEditingCont(!draft.id && selectedRule?.articlePath ? { ...draft, points: getContributionBudget(contributions, draft).suggestedPoints } : draft);
                      }}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-slate-300">
                      <span>积分</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        max={!historicalPointsKept && Number.isFinite(contributionBudget?.availablePoints) ? contributionBudget?.availablePoints : undefined}
                        required
                        value={editingCont.points ?? ''}
                        onChange={e => setEditingCont({...editingCont, points: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm text-slate-300">
                      <span>日期</span>
                      <input
                        type="date"
                        required={!editingCont.id}
                        value={editingCont.date || ''}
                        onChange={e => {
                          const draft = { ...editingCont, date: e.target.value };
                          setEditingCont(!draft.id ? { ...draft, points: getContributionBudget(contributions, draft).suggestedPoints } : draft);
                        }}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200"
                      />
                    </label>
                  </div>

                  {!historicalPointsKept && contributionBudget && Number(editingCont.points) > contributionBudget.availablePoints && (
                    <div data-contribution-limit-warning role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-300">
                      本次最多可计 {contributionBudget.availablePoints} 分，保存后将超出 {Number(editingCont.points) - contributionBudget.availablePoints} 分，请调整积分。
                    </div>
                  )}

                  <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>链接 <span className="text-slate-500">（可选）</span></span>
                    <input
                      type="url"
                      placeholder="https://"
                      value={editingCont.url || ''}
                      onChange={e => setEditingCont({...editingCont, url: e.target.value})}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200"
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>备注 <span className="text-slate-500">{selectedRule?.category === '其他' && !historicalPointsKept ? '（必填）' : '（可选）'}</span></span>
                    <textarea
                      rows={4}
                      required={selectedRule?.category === '其他' && !historicalPointsKept}
                      value={editingCont.notes || ''}
                      onChange={e => setEditingCont({...editingCont, notes: e.target.value})}
                      className="w-full resize-y rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200"
                    />
                  </label>
                </div>

                <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-700 bg-slate-900 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={closeContributionDrawer}
                    className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={savingContribution || !contributionHistoryReady}
                    aria-busy={savingContribution}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingContribution ? '保存中...' : editingCont.id ? '更新贡献' : '添加贡献'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
