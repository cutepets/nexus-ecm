/** Shared Recharts styling so all charts match the design system. */

export const CHART_COLORS = ['#A78BFA', '#67E8F9', '#6EE7B7', '#F9A8D4', '#FCD34D'];

export const axisProps = {
  stroke: '#8E8E93',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  strokeDasharray: '3 3',
  stroke: '#E8E8ED',
  vertical: false,
} as const;

export const tooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #E8E8ED',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    fontSize: 12,
  },
  labelStyle: { color: '#1D1D1F', fontWeight: 500 },
} as const;
