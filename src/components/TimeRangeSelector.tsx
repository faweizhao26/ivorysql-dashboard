'use client';

import { useState, useEffect } from 'react';

type PresetRange = 'today' | '7d' | '30d' | '90d' | '180d' | '365d' | 'custom';

interface DateRange {
  start: string;
  end: string;
  isSingleDay?: boolean;
}

interface Comparison {
  enabled: boolean;
  mode: 'previous' | 'year-over-year' | 'custom';
  customRange?: DateRange;
}

interface TimeRangeSelectorProps {
  onRangeChange: (range: { start: string; end: string; comparison?: Comparison; isSingleDay?: boolean }) => void;
}

const presetOptions = [
  { key: 'today' as const, label: '今天' },
  { key: '7d' as const, label: '最近 7 天' },
  { key: '30d' as const, label: '最近 30 天' },
  { key: '90d' as const, label: '最近 90 天' },
  { key: '180d' as const, label: '最近 180 天' },
  { key: '365d' as const, label: '最近 365 天' },
  { key: 'custom' as const, label: '自定义' },
];

function getDateRange(preset: PresetRange): DateRange {
  const end = new Date();
  const start = new Date();
  
  switch (preset) {
    case 'today':
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        isSingleDay: true
      };
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '180d':
      start.setDate(start.getDate() - 180);
      break;
    case '365d':
      start.setDate(start.getDate() - 365);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

function getComparisonRange(range: DateRange, mode: Comparison['mode']): DateRange | null {
  if (mode === 'previous') {
    const start = new Date(range.start);
    const end = new Date(range.end);
    const diff = end.getTime() - start.getTime();
    
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setTime(prevEnd.getTime() - diff);
    
    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    };
  }
  
  if (mode === 'year-over-year') {
    const start = new Date(range.start);
    const end = new Date(range.end);
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }
  
  return null;
}

export function TimeRangeSelector({ onRangeChange }: TimeRangeSelectorProps) {
  const [preset, setPreset] = useState<PresetRange>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<Comparison['mode']>('previous');

  useEffect(() => {
    const range = getDateRange('today');
    onRangeChange({ ...range });
  }, []);

  const handlePresetChange = (newPreset: PresetRange) => {
    setPreset(newPreset);
    
    if (newPreset === 'custom') {
      return;
    }
    
    const range = getDateRange(newPreset);
    const comparison = comparisonEnabled 
      ? { enabled: true, mode: comparisonMode, customRange: getComparisonRange(range, comparisonMode) ?? undefined }
      : undefined;
    
    onRangeChange({ ...range, comparison });
  };

  const handleCustomDateChange = () => {
    if (customStart && customEnd) {
      const isSingle = customStart === customEnd;
      const range = { start: customStart, end: customEnd, isSingleDay: isSingle };
      const comparison = comparisonEnabled 
        ? { enabled: true, mode: comparisonMode, customRange: getComparisonRange(range, comparisonMode) ?? undefined }
        : undefined;
      
      onRangeChange({ ...range, comparison });
    }
  };

  const handleComparisonChange = () => {
    const newEnabled = !comparisonEnabled;
    setComparisonEnabled(newEnabled);
    
    const range = preset === 'custom' 
      ? { start: customStart, end: customEnd } 
      : getDateRange(preset);
    
    const comparison = newEnabled 
      ? { enabled: true, mode: comparisonMode, customRange: getComparisonRange(range, comparisonMode) ?? undefined }
      : undefined;
    
    onRangeChange({ ...range, comparison });
  };

  const handleComparisonModeChange = (mode: Comparison['mode']) => {
    setComparisonMode(mode);
    
    const range = preset === 'custom' 
      ? { start: customStart, end: customEnd } 
      : getDateRange(preset);
    
    if (comparisonEnabled) {
      const comparison = { enabled: true, mode, customRange: getComparisonRange(range, mode) ?? undefined };
      onRangeChange({ ...range, comparison });
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">时间范围:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {presetOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => handlePresetChange(opt.key)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  preset === opt.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setTimeout(handleCustomDateChange, 0);
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setTimeout(handleCustomDateChange, 0);
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        )}

        <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={comparisonEnabled}
              onChange={handleComparisonChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">开启对比</span>
          </label>

          {comparisonEnabled && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleComparisonModeChange('previous')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  comparisonMode === 'previous'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                vs 上期
              </button>
              <button
                onClick={() => handleComparisonModeChange('year-over-year')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  comparisonMode === 'year-over-year'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                vs 去年同期
              </button>
            </div>
          )}
        </div>
      </div>

      {comparisonEnabled && comparisonMode === 'previous' && (
        <div className="mt-3 text-sm text-gray-500">
          对比时间段: 
          {(() => {
            const range = preset === 'custom' 
              ? { start: customStart, end: customEnd } 
              : getDateRange(preset);
            const comp = getComparisonRange(range, 'previous');
            return comp ? ` ${comp.start} ~ ${comp.end}` : '';
          })()}
        </div>
      )}

      {comparisonEnabled && comparisonMode === 'year-over-year' && (
        <div className="mt-3 text-sm text-gray-500">
          对比时间段: 
          {(() => {
            const range = preset === 'custom' 
              ? { start: customStart, end: customEnd } 
              : getDateRange(preset);
            const comp = getComparisonRange(range, 'year-over-year');
            return comp ? ` ${comp.start} ~ ${comp.end}` : '';
          })()}
        </div>
      )}
    </div>
  );
}

export type { DateRange, Comparison };