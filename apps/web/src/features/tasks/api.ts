'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  orderIndex: number;
  project?: { id: string; name: string; code: string } | null;
  assignees: { employeeId: string; employee: { id: string; fullName: string } }[];
  _count: { checklist: number; comments: number };
}

export interface TaskDetail extends Omit<TaskListItem, '_count'> {
  description?: string | null;
  checklist: { id: string; label: string; done: boolean }[];
  comments: { id: string; body: string; createdAt: string; author: { id: string; fullName: string } }[];
  attachments: { id: string; fileName: string; fileUrl: string }[];
}

const keys = {
  all: ['tasks'] as const,
  list: (f: Record<string, string | undefined>) => ['tasks', 'list', f] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

export function useTasks(filters: { projectId?: string; status?: string; assigneeId?: string } = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => (await api.get<TaskListItem[]>('/tasks', { params: filters })).data,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await api.get<TaskDetail>(`/tasks/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<TaskListItem>('/tasks', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Đã tạo công việc');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể tạo công việc')),
  });
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) =>
      (await api.patch(`/tasks/${id}/move`, { status })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể chuyển trạng thái công việc')),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Đã xóa công việc');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể xóa công việc')),
  });
}

export function useAddChecklist(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => (await api.post(`/tasks/${taskId}/checklist`, { label })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detail(taskId) }),
  });
}

export function useToggleChecklist(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => (await api.patch(`/tasks/checklist/${itemId}/toggle`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detail(taskId) }),
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { body: string; authorId?: string }) =>
      (await api.post(`/tasks/${taskId}/comments`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detail(taskId) }),
    onError: (e) => toast.error(errMsg(e, 'Không thể thêm bình luận')),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
