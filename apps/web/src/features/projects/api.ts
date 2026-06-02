'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface ProjectListItem {
  id: string;
  name: string;
  code: string;
  status: string;
  progress: number;
  deadline?: string | null;
  budgetPlanned: string;
  budgetActual: string;
  _count: { tasks: number; members: number };
}

export interface ProjectDetail extends ProjectListItem {
  description?: string | null;
  startDate?: string | null;
  members: { employeeId: string; role?: string | null; employee: { id: string; fullName: string; employeeNo: string } }[];
  milestones: { id: string; title: string; dueDate?: string | null; completed: boolean }[];
}

const keys = {
  all: ['projects'] as const,
  list: (s?: string) => ['projects', 'list', s ?? 'all'] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

export function useProjects(status?: string) {
  return useQuery({
    queryKey: keys.list(status),
    queryFn: async () => (await api.get<ProjectListItem[]>('/projects', { params: status ? { status } : undefined })).data,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<ProjectListItem>('/projects', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      toast.success('Proyek dibuat');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat proyek')),
  });
}

export function useAddMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; dueDate?: string }) =>
      (await api.post(`/projects/${projectId}/milestones`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detail(projectId) }),
    onError: (e) => toast.error(errMsg(e, 'Gagal menambah milestone')),
  });
}

export function useToggleMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, completed }: { id: string; title: string; completed: boolean }) =>
      (await api.put(`/projects/milestones/${id}`, { title, completed })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detail(projectId) }),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
