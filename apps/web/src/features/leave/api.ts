'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface LeaveType {
  id: string;
  name: string;
  defaultQuota: number;
  requiresDoc: boolean;
}

export interface LeaveBalance {
  id: string;
  year: number;
  allocated: number;
  used: number;
  remaining: number;
  leaveType: { id: string; name: string };
}

export interface LeaveApproval {
  id: string;
  step: number;
  role: string;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string | null;
  decidedAt?: string | null;
  approver?: { id: string; fullName: string } | null;
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  currentStep: number;
  createdAt: string;
  employee: { id: string; fullName: string; employeeNo: string };
  leaveType: { id: string; name: string; requiresDoc: boolean };
  approvals: LeaveApproval[];
}

const keys = {
  types: ['leave', 'types'] as const,
  balances: (id: string) => ['leave', 'balances', id] as const,
  requests: (f: Record<string, string | undefined>) => ['leave', 'requests', f] as const,
  inbox: ['leave', 'inbox'] as const,
  detail: (id: string) => ['leave', 'detail', id] as const,
};

export function useLeaveTypes() {
  return useQuery({
    queryKey: keys.types,
    queryFn: async () => (await api.get<LeaveType[]>('/leave/types')).data,
  });
}

export function useLeaveBalances(employeeId: string) {
  return useQuery({
    queryKey: keys.balances(employeeId),
    queryFn: async () => (await api.get<LeaveBalance[]>(`/leave/balances/${employeeId}`)).data,
    enabled: !!employeeId,
  });
}

export function useLeaveRequests(filters: { employeeId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: keys.requests(filters),
    queryFn: async () => (await api.get<LeaveRequest[]>('/leave/requests', { params: filters })).data,
  });
}

export function useLeaveInbox(enabled = true) {
  return useQuery({
    queryKey: keys.inbox,
    queryFn: async () => (await api.get<LeaveRequest[]>('/leave/requests/inbox')).data,
    enabled,
  });
}

export function useLeaveRequest(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await api.get<LeaveRequest>(`/leave/requests/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<LeaveRequest>('/leave/requests', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Đã gửi đơn nghỉ phép');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể gửi đơn nghỉ phép')),
  });
}

export function useDecideLeave(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { decision: 'APPROVED' | 'REJECTED'; comment?: string }) =>
      (await api.post(`/leave/requests/${id}/decision`, payload)).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      toast.success(v.decision === 'APPROVED' ? 'Đã duyệt đơn' : 'Đã từ chối đơn');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể xử lý quyết định')),
  });
}

export function useWithdrawLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leave/requests/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Pengajuan ditarik');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể rút đơn')),
  });
}

/** Upload a supporting document via presign → PUT; returns the object key. */
export async function uploadLeaveDoc(file: File): Promise<string> {
  const { data } = await api.post<{ url: string; key: string }>('/leave/uploads', {
    fileName: file.name,
  });
  await fetch(data.url, { method: 'PUT', body: file });
  return data.key;
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
