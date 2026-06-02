'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type {
  Department,
  EmployeeDetail,
  EmployeeListItem,
  Position,
} from '@nexus/shared';
import type { PaginatedResult } from '@nexus/shared';

export interface EmployeeFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  workStatus?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const keys = {
  all: ['employees'] as const,
  list: (f: EmployeeFilters) => ['employees', 'list', f] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
  departments: ['departments'] as const,
  positions: (deptId?: string) => ['positions', deptId ?? 'all'] as const,
};

// ---- Employees ----

export function useEmployees(filters: EmployeeFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResult<EmployeeListItem>>('/employees', {
        params: filters,
      });
      return data;
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<EmployeeDetail>(`/employees/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post<EmployeeListItem>('/employees', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      toast.success('Karyawan berhasil dibuat');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat karyawan')),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put<EmployeeListItem>(`/employees/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success('Perubahan tersimpan');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal menyimpan perubahan')),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      toast.success('Karyawan dinonaktifkan');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal menghapus karyawan')),
  });
}

// ---- Departments & positions (for form selects) ----

export function useDepartments() {
  return useQuery({
    queryKey: keys.departments,
    queryFn: async () => {
      const { data } = await api.get<Department[]>('/departments');
      return data;
    },
  });
}

export function usePositions(departmentId?: string) {
  return useQuery({
    queryKey: keys.positions(departmentId),
    queryFn: async () => {
      const { data } = await api.get<Position[]>('/positions', {
        params: departmentId ? { departmentId } : undefined,
      });
      return data;
    },
  });
}

// ---- History & documents ----

export function useAddSalaryHistory(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { amount: string; effectiveDate: string; reason?: string }) => {
      const { data } = await api.post(`/employees/${employeeId}/salary-history`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(employeeId) });
      toast.success('Riwayat gaji ditambahkan');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal menambah riwayat gaji')),
  });
}

export function useDeleteDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/employees/${employeeId}/documents/${docId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(employeeId) });
      toast.success('Dokumen dihapus');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal menghapus dokumen')),
  });
}

/**
 * Upload a document via the presigned-URL flow: presign → PUT to MinIO →
 * confirm so the API records it.
 */
export function useUploadDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      const { data: presign } = await api.post<{ url: string; key: string }>(
        `/employees/${employeeId}/uploads`,
        { fileName: file.name, kind: 'document' },
      );
      await fetch(presign.url, { method: 'PUT', body: file });
      const { data } = await api.post(`/employees/${employeeId}/documents`, {
        docType,
        fileUrl: presign.key,
        fileName: file.name,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(employeeId) });
      toast.success('Dokumen diunggah');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal mengunggah dokumen')),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
