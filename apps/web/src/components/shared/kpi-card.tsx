import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type Accent = 'purple' | 'cyan' | 'mint' | 'pink';

const ACCENT_DOT: Record<Accent, string> = {
  purple: 'bg-accent-purple',
  cyan: 'bg-accent-cyan',
  mint: 'bg-accent-mint',
  pink: 'bg-accent-pink',
};

const ACCENT_ICON: Record<Accent, string> = {
  purple: 'bg-accent-purple/15 text-purple-700',
  cyan: 'bg-accent-cyan/20 text-cyan-700',
  mint: 'bg-accent-mint/20 text-emerald-700',
  pink: 'bg-accent-pink/20 text-pink-700',
};

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  /** Percentage change vs. previous period; positive renders green, negative red. */
  delta?: number;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'purple',
  delta,
  loading,
}: KpiCardProps) {
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          {!Icon && <span className={cn('size-2 rounded-full', ACCENT_DOT[accent])} />}
          {label}
        </div>
        {Icon && (
          <span className={cn('flex size-9 items-center justify-center rounded-xl', ACCENT_ICON[accent])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <div className="mt-3 text-3xl font-medium tracking-tight">{value}</div>
      )}

      {delta !== undefined && !loading && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-xs font-medium',
            delta >= 0 ? 'text-emerald-600' : 'text-red-600',
          )}
        >
          {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(delta)}%
          <span className="text-ink-subtle">so với tháng trước</span>
        </div>
      )}
    </div>
  );
}
