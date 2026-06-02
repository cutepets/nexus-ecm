import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Card frame for charts: consistent header + padded body. */
export function ChartCard({ title, description, action, className, children }: ChartCardProps) {
  return (
    <div className={cn('rounded-card border border-border bg-card p-6 shadow-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-medium tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 h-72">{children}</div>
    </div>
  );
}
