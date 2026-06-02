'use client';

import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, axisProps, gridProps, tooltipProps } from './theme';

export interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label?: string; color?: string }[];
  valueFormatter?: (value: number) => string;
  stacked?: boolean;
}

export function BarChart({ data, xKey, series, valueFormatter, stacked }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReBarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={valueFormatter} width={valueFormatter ? 64 : 32} />
        <Tooltip
          {...tooltipProps}
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label ?? s.key}
            stackId={stacked ? 'stack' : undefined}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={stacked ? 0 : [6, 6, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </ReBarChart>
    </ResponsiveContainer>
  );
}
