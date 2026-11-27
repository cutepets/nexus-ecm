'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface CandidateBranch {
  id: string;
  name: string;
}

export interface CandidateCreator {
  id: string;
  fullName: string;
}

export type CandidateStatus = 'REVIEW' | 'APPROVED' | 'FOLLOW_UP' | 'REJECTED';
export const CANDIDATE_STATUS_OPTIONS: Array<{ value: CandidateStatus; label: string }> = [
  { value: 'REVIEW', label: 'Xét duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'FOLLOW_UP', label: 'Hẹn sau' },
  { value: 'REJECTED', label: 'Từ chối' },
];

export interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  photoKey: string | null;
  photoUrl: string | null;
  desiredBranches: CandidateBranch[];
  desiredShift: string | null;
  desiredStartDate: string | null;
  status: CandidateStatus;
  source: string | null;
  notes: string | null;
  createdById: string | null;
  createdBy: CandidateCreator | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateInput {
  fullName: string;
  phone: string;
  address?: string;
  photoKey?: string;
  desiredBranchIds?: string[];
  desiredShift?: string;
  desiredStartDate?: string;
  source?: string;
  notes?: string;
}

export type CandidateUpdateInput = Partial<CandidateInput> & { status?: CandidateStatus };

const queryKey = ['candidates'] as const;

export function useCandidates() {
  return useQuery({
    queryKey,
    queryFn: async () => (await api.get<Candidate[]>('/candidates')).data,
  });
}

export function useCandidateBranches() {
  return useQuery({
    queryKey: [...queryKey, 'branches'],
    queryFn: async () => (await api.get<CandidateBranch[]>('/candidates/options/branches')).data,
  });
}

export function useCreateCandidate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CandidateInput) => (await api.post<Candidate>('/candidates', input)).data,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey });
      toast.success('Đã thêm ứng viên');
    },
    onError: (error) => toast.error(candidateErrorMessage(error, 'Không thể thêm ứng viên')),
  });
}

export function useUpdateCandidate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CandidateUpdateInput & { id: string }) => (await api.patch<Candidate>(`/candidates/${id}`, input)).data,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey });
      toast.success('Đã lưu ứng viên');
    },
    onError: (error) => toast.error(candidateErrorMessage(error, 'Không thể lưu ứng viên')),
  });
}

export function useDeleteCandidate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/candidates/${id}`)).data,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey });
      toast.success('Đã xóa ứng viên');
    },
    onError: () => toast.error('Không thể xóa ứng viên'),
  });
}

function candidateErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join('; ') : message || fallback;
}

export async function uploadCandidatePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh không được lớn hơn 5 MB');

  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const fileName = file.name.includes('.') ? file.name : `candidate-photo.${extensions[file.type]}`;
  const { data: upload } = await api.post<{ url: string; key: string }>('/candidates/uploads', { fileName });
  const response = await fetch(upload.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!response.ok) throw new Error('Tải ảnh ứng viên lên không thành công');
  return upload.key;
}
