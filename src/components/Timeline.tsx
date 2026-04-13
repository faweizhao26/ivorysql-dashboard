'use client';

import { format, parseISO } from 'date-fns';

interface Event {
  date: string;
  source: string;
  title: string;
  description: string;
  url: string;
  event_type: string;
}

interface ActivityTimelineProps {
  events: Event[];
  title?: string;
}

const typeIcons: Record<string, string> = {
  github_issue: '📋',
  github_pr: '🔀',
  release: '🚀',
  blog: '📝',
  event: '📅',
  news: '📰',
  default: '📌'
};

const typeColors: Record<string, string> = {
  github_issue: 'bg-blue-100 text-blue-700',
  github_pr: 'bg-green-100 text-green-700',
  release: 'bg-purple-100 text-purple-700',
  blog: 'bg-orange-100 text-orange-700',
  event: 'bg-pink-100 text-pink-700',
  news: 'bg-gray-100 text-gray-700',
  default: 'bg-indigo-100 text-indigo-700'
};

export function ActivityTimeline({ events, title = '社区动态' }: ActivityTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-gray-400 text-center py-8">暂无动态</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {events.map((event, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                typeColors[event.event_type] || typeColors.default
              }`}>
                {typeIcons[event.event_type] || typeIcons.default}
              </div>
              {index < events.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-2" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  typeColors[event.event_type] || typeColors.default
                }`}>
                  {event.source}
                </span>
                <span className="text-xs text-gray-400">
                  {format(parseISO(event.date), 'MM/dd HH:mm')}
                </span>
              </div>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 hover:text-indigo-600 block"
              >
                {event.title}
              </a>
              {event.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
