import * as React from 'react';
import { cn } from '@/lib/utils';

/** Native styled select — keeps the dependency surface small. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 w-full rounded-xl border border-border bg-card px-3 text-sm text-ink outline-none transition-colors',
      'focus-visible:ring-2 focus-visible:ring-accent-purple/30 disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
