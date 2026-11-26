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
      toast.success('Đã tạo nhân viên');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể tạo nhân viên')),
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
      toast.success('Đã lưu thay đổi');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể lưu thay đổi')),
  });
}

/** Upload the two identity-card images before the employee record is created. */
export async function uploadNewEmployeeIdentityCards(files: { front?: File; back?: File }) {
  const upload = async (file: File, kind: 'identity-front' | 'identity-back') => {
    const { data: presign } = await api.post<{ url: string; key: string }>('/employees/uploads/create', { fileName: file.name, kind });
    const response = await fetch(presign.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
    if (!response.ok) throw new Error('Identity-card upload failed');
    return presign.key;
  };
  const [front, back] = await Promise.all([
    files.front ? upload(files.front, 'identity-front') : undefined,
    files.back ? upload(files.back, 'identity-back') : undefined,
  ]);
  return {
    ...(front ? { identityCardFrontUrl: front } : {}),
    ...(back ? { identityCardBackUrl: back } : {}),
  };
}

export async function uploadEmployeeIdentityCards(employeeId: string, files: { front?: File; back?: File }) {
  const upload = async (file: File, label: string) => {
    const { data: presign } = await api.post<{ url: string; key: string }>(
      `/employees/${employeeId}/uploads`,
      { fileName: file.name, kind: 'document' },
    );
    const response = await fetch(presign.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
    if (!response.ok) throw new Error('Identity-card upload failed');
    await api.post(`/employees/${employeeId}/documents`, {
      docType: 'OTHER', fileUrl: presign.key, fileName: label,
    });
  };
  await Promise.all([
    files.front ? upload(files.front, 'CCCD mặt trước') : Promise.resolve(),
    files.back ? upload(files.back, 'CCCD mặt sau') : Promise.resolve(),
  ]);
}

export async function uploadEmploymentHistoryDocuments(employeeId: string, files: File[]) {
  return Promise.all(files.map(async (file) => {
    const { data: presign } = await api.post<{ url: string; key: string }>(
      `/employees/${employeeId}/uploads`,
      { fileName: file.name, kind: 'document' },
    );
    const response = await fetch(presign.url, { method: 'PUT', body: file });
    if (!response.ok) throw new Error(`Upload failed: ${file.name}`);
    return { fileUrl: presign.key, fileName: file.name };
  }));
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentPassword }: { id: string; currentPassword: string }) => {
      await api.post(`/employees/${id}/permanent-delete`, { currentPassword });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      toast.success('Đã xóa vĩnh viễn nhân viên và dữ liệu liên quan');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể xóa nhân viên')),
  });
}

export interface DeletionEligibility {
  employeeId: string;
  fullName: string;
  canDelete: boolean;
  total: number;
  history: Record<string, number>;
}

export function useDeletionEligibility(id: string) {
  return useQuery({
    queryKey: [...keys.detail(id), 'deletion-eligibility'],
    queryFn: async () => (await api.get<DeletionEligibility>(`/employees/${id}/deletion-eligibility`)).data,
    enabled: !!id,
  });
}

export function useTerminateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, terminationDate, terminationReason, decisionNumber, historyDocuments }: { id: string; terminationDate: string; terminationReason: string; decisionNumber?: string; historyDocuments?: { fileUrl: string; fileName: string }[] }) =>
      (await api.post(`/employees/${id}/terminate`, { terminationDate, terminationReason, decisionNumber, historyDocuments })).data,
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.detail(variables.id) });
      toast.success('Đã cho thôi việc, khóa tài khoản và thu hồi phiên');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể cho thôi việc')),
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

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; code: string }) => (await api.post<Department>('/departments', payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.departments }); toast.success('Đã thêm phòng ban'); },
    onError: (e) => toast.error(errMsg(e, 'Không thể thêm phòng ban')),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; code: string }) => (await api.put<Department>(`/departments/${id}`, payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.departments }); toast.success('Đã cập nhật phòng ban'); },
    onError: (e) => toast.error(errMsg(e, 'Không thể cập nhật phòng ban')),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/departments/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.departments }); toast.success('Đã xóa phòng ban'); },
    onError: (e) => toast.error(errMsg(e, 'Không thể xóa phòng ban đang được sử dụng')),
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; departmentId: string; level: number }) => (await api.post<Position>('/positions', payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); toast.success('Đã thêm chức vụ'); },
    onError: (e) => toast.error(errMsg(e, 'Không thể thêm chức vụ')),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title: string; departmentId: string; level: number }) => (await api.put<Position>(`/positions/${id}`, payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); toast.success('Đã cập nhật chức vụ'); },
    onError: (e) => toast.error(errMsg(e, 'Không thể cập nhật chức vụ')),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/positions/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); toast.success('Đã xóa chức vụ'); },
    onError: (e) => toast.error(errMsg(e, 'Không thể xóa chức vụ đang được nhân viên sử dụng')),
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
      toast.success('Đã thêm lịch sử lương');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể thêm lịch sử lương')),
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
      toast.success('Đã xóa tài liệu');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể xóa tài liệu')),
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
      toast.success('Đã tải tài liệu lên');
    },
    onError: (e) => toast.error(errMsg(e, 'Không thể tải tài liệu lên')),
  });
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
