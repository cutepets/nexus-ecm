import { Badge, type BadgeProps } from '@/components/ui/badge';

type Tone = NonNullable<BadgeProps['tone']>;

/**
 * Maps domain status strings to badge tones. Covers the statuses used across
 * attendance, leave, projects, tasks, invoices, etc. Unknown values fall back
 * to neutral, so it is safe to pass any status string.
 */
const STATUS_TONE: Record<string, Tone> = {
  // generic
  ACTIVE: 'mint',
  INACTIVE: 'neutral',
  PENDING: 'amber',
  APPROVED: 'mint',
  REJECTED: 'red',
  CANCELLED: 'neutral',
  DRAFT: 'neutral',
  // attendance
  PRESENT: 'mint',
  LATE: 'amber',
  ABSENT: 'red',
  LEAVE: 'purple',
  PERMIT: 'cyan',
  // projects / tasks
  PLANNED: 'neutral',
  IN_PROGRESS: 'cyan',
  ON_HOLD: 'amber',
  COMPLETED: 'mint',
  DONE: 'mint',
  TODO: 'neutral',
  REVIEW: 'purple',
  // finance
  PAID: 'mint',
  UNPAID: 'amber',
  OVERDUE: 'red',
  PARTIAL: 'cyan',
};

/** Humanize an enum-ish status: "IN_PROGRESS" → "In Progress". */
function humanize(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface StatusBadgeProps {
  status: string;
  /** Override the auto-derived label. */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = STATUS_TONE[status?.toUpperCase()] ?? 'neutral';
  return <Badge tone={tone}>{label ?? humanize(status)}</Badge>;
}
