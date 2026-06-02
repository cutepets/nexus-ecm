import type { TaskPriority, TaskStatus } from './api';

export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'REVIEW', label: 'Review' },
  { status: 'DONE', label: 'Done' },
];

export const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'cyan' | 'amber' | 'red'> = {
  LOW: 'neutral',
  MEDIUM: 'cyan',
  HIGH: 'amber',
  CRITICAL: 'red',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
  CRITICAL: 'Kritis',
};
