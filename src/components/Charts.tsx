'use client';

import { getBeijingDate } from '@/lib/date';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart
} from 'recharts';

function chartColor(color: string) {
  const themed: Record<string, string> = { '#6366f1': 'var(--chart-primary)', '#a855f7': 'var(--chart-secondary)', '#22d3ee': 'var(--accent-cyan)' };
  return themed[color.toLowerCase()] || color;
}

const chartTooltipStyle = { backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '6px' };

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export function formatDateTick(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  const day = getBeijingDate(date);
  return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
}

interface LineChartProps {
  title: string;
  data: ChartDataPoint[];
  dataKey: string;
  color?: string;
  gradientId?: string;
}

export function TrendChart({ title, data, dataKey, color = '#6366F1', gradientId }: LineChartProps) {
  const id = gradientId || `gradient-${dataKey}`;
  const seriesColor = chartColor(color);
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={seriesColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={seriesColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--chart-label)' }}
              tickFormatter={formatDateTick}
            />
            <YAxis tick={{ fontSize: 12, fill: 'var(--chart-label)' }} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, dataKey]}
              labelFormatter={(label) => `日期: ${label}`}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={seriesColor}
              strokeWidth={2}
              fill={`url(#${id})`}
              dot={{ fill: seriesColor, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface MultiLineChartProps {
  title: string;
  data: ChartDataPoint[];
  dataKeys: string[];
  colors?: string[];
}

export function MultiLineChart({ title, data, dataKeys, colors = ['#6366F1', '#10B981', '#F59E0B'] }: MultiLineChartProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--chart-label)' }}
              tickFormatter={formatDateTick}
            />
            <YAxis tick={{ fontSize: 12, fill: 'var(--chart-label)' }} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelFormatter={(label) => `日期: ${label}`}
            />
            <Legend />
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColor(colors[index % colors.length])}
                strokeWidth={2}
                dot={{ fill: chartColor(colors[index % colors.length]), strokeWidth: 2, r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface BarChartProps {
  title: string;
  data: ChartDataPoint[];
  dataKey: string;
  color?: string;
}

export function BarChartComponent({ title, data, dataKey, color = '#6366F1' }: BarChartProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--chart-label)' }}
              tickFormatter={formatDateTick}
            />
            <YAxis tick={{ fontSize: 12, fill: 'var(--chart-label)' }} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, dataKey]}
              labelFormatter={(label) => `日期: ${label}`}
            />
            <Bar dataKey={dataKey} fill={chartColor(color)} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
