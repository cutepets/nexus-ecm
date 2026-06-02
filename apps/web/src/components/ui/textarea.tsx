import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink outline-none transition-colors',
      'placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-accent-purple/30 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
