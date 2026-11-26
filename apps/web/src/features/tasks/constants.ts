import type { TaskPriority, TaskStatus } from './api';

export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'Cần thực hiện' },
  { status: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { status: 'REVIEW', label: 'Chờ duyệt' },
  { status: 'DONE', label: 'Hoàn thành' },
];

export const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'cyan' | 'amber' | 'red'> = {
  LOW: 'neutral',
  MEDIUM: 'cyan',
  HIGH: 'amber',
  CRITICAL: 'red',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  CRITICAL: 'Khẩn cấp',
};
