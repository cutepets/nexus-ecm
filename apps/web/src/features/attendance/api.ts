'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface AttendanceRecord {
  id: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: string;
  matchScore?: number | null;
  livenessPassed: boolean;
  employee: { id: string; fullName: string; employeeNo: string };
}

export interface AttendanceSummary {
  date: string;
  totalActive: number;
  counts: Record<string, number>;
}

interface CheckPayload {
  employeeId: string;
  embedding: number[];
  livenessPassed: boolean;
  lat?: number;
  lng?: number;
  photo?: string;
  deviceInfo?: Record<string, unknown>;
}

const keys = {
  list: (d?: string) => ['attendance', 'list', d ?? 'today'] as const,
  summary: (d?: string) => ['attendance', 'summary', d ?? 'today'] as const,
  faceStatus: (id: string) => ['attendance', 'face-status', id] as const,
};

export function useAttendanceList(date?: string) {
  return useQuery({
    queryKey: keys.list(date),
    queryFn: async () => {
      const { data } = await api.get<AttendanceRecord[]>('/attendance', {
        params: date ? { date } : undefined,
      });
      return data;
    },
  });
}

export interface MyAttendanceSummary {
  counts: Record<string, number>;
  today: { checkInAt?: string | null; checkOutAt?: string | null; status: string } | null;
  enrolled: boolean;
}

export function useMyAttendanceSummary() {
  return useQuery({
    queryKey: ['attendance', 'me-summary'],
    queryFn: async () => (await api.get<MyAttendanceSummary>('/attendance/me/summary')).data,
  });
}

export function useAttendanceSummary(date?: string) {
  return useQuery({
    queryKey: keys.summary(date),
    queryFn: async () => {
      const { data } = await api.get<AttendanceSummary>('/attendance/summary', {
        params: date ? { date } : undefined,
      });
      return data;
    },
  });
}

export function useFaceStatus(employeeId: string) {
  return useQuery({
    queryKey: keys.faceStatus(employeeId),
    queryFn: async () => {
      const { data } = await api.get<{ enrolled: boolean; profiles: number }>(
        `/attendance/face/${employeeId}/status`,
      );
      return data;
    },
    enabled: !!employeeId,
  });
}

export function useEnrollFace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employeeId: string; embeddings: number[][]; sampleImage?: string }) => {
      const { data } = await api.post('/attendance/face/enroll', payload);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.faceStatus(v.employeeId) });
      toast.success('Wajah berhasil didaftarkan');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal mendaftarkan wajah')),
  });
}

export function useCheck(kind: 'check-in' | 'check-out') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CheckPayload) => {
      const { data } = await api.post(`/attendance/${kind}`, payload);
      return data as AttendanceRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(kind === 'check-in' ? 'Check-in berhasil' : 'Check-out berhasil');
    },
    onError: (e) => toast.error(errMsg(e, 'Verifikasi gagal')),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
