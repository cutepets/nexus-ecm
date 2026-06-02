'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  activeProjects: number;
  pendingTasks: number;
  pendingLeaves: number;
  monthIncome: number;
}
export interface ActivityItem {
  id: string; action: string; entity: string; createdAt: string;
  actor?: { id: string; fullName: string } | null;
}
export interface SearchHit { type: string; id: string; title: string; subtitle?: string; href: string }
export interface Notification { id: string; type: string; title: string; body?: string | null; isRead: boolean; createdAt: string }
export interface AuditLog {
  id: string; action: string; entity: string; entityId?: string | null; createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
}

export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data });
}
export function useActivity() {
  return useQuery({ queryKey: ['dashboard', 'activity'], queryFn: async () => (await api.get<ActivityItem[]>('/dashboard/activity')).data });
}

export async function globalSearch(q: string): Promise<SearchHit[]> {
  if (q.trim().length < 2) return [];
  return (await api.get<SearchHit[]>('/search', { params: { q } })).data;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<Notification[]>('/notifications')).data,
    refetchInterval: 30_000,
  });
}
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => (await api.get<{ count: number }>('/notifications/unread-count')).data,
    refetchInterval: 30_000,
  });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/notifications/read-all')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useAuditLogs(filters: { entity?: string; action?: string } = {}) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => (await api.get<AuditLog[]>('/audit-logs', { params: filters })).data,
  });
}
