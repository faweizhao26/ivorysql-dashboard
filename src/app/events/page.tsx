'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { TimeRangeSelector, DateRange } from '@/components/TimeRangeSelector';

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
  { value: 'conference', label: '技术大会', icon: '🏛️' },
  { value: 'meetup', label: '线下聚会', icon: '👥' },
  { value: 'webinar', label: '线上直播', icon: '💻' },
  { value: 'workshop', label: '工作坊', icon: '🔧' },
  { value: 'hackathon', label: '黑客马拉松', icon: '🏆' },
  { value: 'other', label: '其他', icon: '📌' },
];

const eventTypeColors: Record<string, string> = {
  conference: 'bg-purple-100 text-purple-700',
  meetup: 'bg-blue-100 text-blue-700',
  webinar: 'bg-green-100 text-green-700',
  workshop: 'bg-orange-100 text-orange-700',
  hackathon: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
};

const emptyEvent: ActivityEvent = {
  event_name: '',
  event_date: '',
  event_type: 'conference',
  participants: 0,
  registrations: 0,
  online_viewers: 0,
  collected_data: {},
};

export default function EventsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today,
      isSingleDay: true
    };
  });
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<ActivityEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/events', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(event: ActivityEvent) {
    setEditingEvent({ ...event });
    setIsEditing(true);
    setShowModal(true);
  }

  function handleAdd() {
    setEditingEvent({ ...emptyEvent, event_date: new Date().toISOString().split('T')[0] });
    setIsEditing(false);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const url = isEditing ? '/api/events' : '/api/events';
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEvent)
      });

      if (res.ok) {
        setShowModal(false);
        setEditingEvent(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const totalParticipants = events.reduce((sum, e) => sum + (e.participants || 0), 0);
  const totalRegistrations = events.reduce((sum, e) => sum + (e.registrations || 0), 0);
  const totalOnline = events.reduce((sum, e) => sum + (e.online_viewers || 0), 0);
  const upcomingEvents = events.filter(e => new Date(e.event_date) >= new Date());
  const pastEvents = events.filter(e => new Date(e.event_date) < new Date());

  const currentPeriod = `${dateRange.start} ~ ${dateRange.end}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <h1 className="text-2xl font-bold text-gray-900">社区活动</h1>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          + 新增活动
        </button>
      </div>

      <TimeRangeSelector onRangeChange={(range) => {
        setDateRange({ start: range.start, end: range.end, isSingleDay: range.isSingleDay });
      }} />

      <div className="text-sm text-gray-500">
        当前时间段: <span className="font-medium text-gray-700">{currentPeriod}</span>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">活动统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="总活动数"
            value={events.length}
            icon="📊"
          />
          <StatCard
            title="总参与人数"
            value={totalParticipants}
            icon="👥"
          />
          <StatCard
            title="总报名人数"
            value={totalRegistrations}
            icon="📝"
          />
          <StatCard
            title="线上观看"
            value={totalOnline}
            icon="👁️"
          />
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <p className="text-gray-500">
            暂无活动数据。<br />
            请在 <a href="/admin" className="text-indigo-600 hover:underline">管理后台</a> 的「活动管理」中录入活动数据。
          </p>
        </div>
      ) : (
        <>
          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">即将举办</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} isUpcoming onEdit={handleEdit} onDelete={(id) => setDeleteConfirm(id)} />
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">往期活动</h2>
              <div className="space-y-4">
                {pastEvents.map(event => (
                  <EventCard key={event.id} event={event} onEdit={handleEdit} onDelete={(id) => setDeleteConfirm(id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{isEditing ? '编辑活动' : '新增活动'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活动名称 *</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.event_name}
                    onChange={(e) => setEditingEvent({ ...editingEvent, event_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活动日期 *</label>
                  <input
                    type="date"
                    required
                    value={editingEvent.event_date}
                    onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活动类型 *</label>
                  <select
                    required
                    value={editingEvent.event_type}
                    onChange={(e) => setEditingEvent({ ...editingEvent, event_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {eventTypeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">地点</label>
                  <input
                    type="text"
                    value={editingEvent.location || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">场馆/平台</label>
                  <input
                    type="text"
                    value={editingEvent.venue || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">参与人数</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEvent.participants}
                    onChange={(e) => setEditingEvent({ ...editingEvent, participants: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">报名人数</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEvent.registrations}
                    onChange={(e) => setEditingEvent({ ...editingEvent, registrations: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">线上观看人数</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEvent.online_viewers}
                    onChange={(e) => setEditingEvent({ ...editingEvent, online_viewers: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活动链接</label>
                <input
                  type="url"
                  value={editingEvent.url || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活动描述</label>
                <textarea
                  rows={3}
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-gray-600 mb-4">确定要删除这个活动吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, isUpcoming = false, onEdit, onDelete }: { 
  event: ActivityEvent; 
  isUpcoming?: boolean;
  onEdit?: (event: ActivityEvent) => void;
  onDelete?: (id: number) => void;
}) {
  const eventType = eventTypeOptions.find(t => t.value === event.event_type) || eventTypeOptions[5];
  const attendanceRate = event.registrations > 0 
    ? Math.round((event.participants / event.registrations) * 100) 
    : 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${isUpcoming ? 'border-indigo-200' : 'border-gray-200'} overflow-hidden`}>
      {isUpcoming && (
        <div className="bg-indigo-50 px-4 py-1 text-xs text-indigo-600 font-medium">
          即将举办
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{eventType.icon}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${eventTypeColors[event.event_type] || eventTypeColors.other}`}>
              {eventType.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {new Date(event.event_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {event.id && onEdit && onDelete && (
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(event)}
                  className="p-1 text-gray-400 hover:text-indigo-600"
                  title="编辑"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onDelete(event.id!)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.event_name}</h3>

        {event.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{event.description}</p>
        )}

        <div className="space-y-2 text-sm">
          {event.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <span>📍</span>
              <span>{event.location}</span>
            </div>
          )}
          {event.venue && (
            <div className="flex items-center gap-2 text-gray-600">
              <span>🏢</span>
              <span>{event.venue}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">{event.participants}</div>
              <div className="text-xs text-gray-500">参与人数</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{event.registrations}</div>
              <div className="text-xs text-gray-500">报名人数</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{attendanceRate}%</div>
              <div className="text-xs text-gray-500">出勤率</div>
            </div>
          </div>
        </div>

        {event.online_viewers > 0 && (
          <div className="mt-3 text-center text-sm text-gray-500">
            线上观看 {event.online_viewers.toLocaleString()} 人
          </div>
        )}

        {event.url && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <a 
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              查看详情 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}