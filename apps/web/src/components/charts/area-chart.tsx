'use client';

import {
  Area,
  AreaChart as ReAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, axisProps, gridProps, tooltipProps } from './theme';

export interface AreaChartProps {
  data: Record<string, unknown>[];
  /** Key holding the x-axis category (e.g. month). */
  xKey: string;
  /** One or more numeric series to stack as areas. */
  series: { key: string; label?: string; color?: string }[];
  /** Format y-axis ticks & tooltip values (e.g. currency). */
  valueFormatter?: (value: number) => string;
}

export function AreaChart({ data, xKey, series, valueFormatter }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReAreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
            return (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={valueFormatter} width={valueFormatter ? 64 : 32} />
        <Tooltip
          {...tooltipProps}
          formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined}
        />
        {series.map((s, i) => {
          const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
            />
          );
        })}
      </ReAreaChart>
    </ResponsiveContainer>
  );
}
