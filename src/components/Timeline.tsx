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
  github_issue: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  github_pr: 'bg-green-500/20 text-green-300 border border-green-500/30',
  release: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  blog: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  event: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  news: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  default: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
};

export function ActivityTimeline({ events, title = '社区动态' }: ActivityTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
        <div className="text-slate-500 text-center py-8">暂无动态</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
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
                <div className="w-0.5 h-full bg-slate-700 mt-2" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  typeColors[event.event_type] || typeColors.default
                }`}>
                  {event.source}
                </span>
                <span className="text-xs text-slate-500">
                  {format(parseISO(event.date), 'MM/dd HH:mm')}
                </span>
              </div>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-200 hover:text-indigo-400 block"
              >
                {event.title}
              </a>
              {event.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
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
