'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface SelfProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  avatarOriginalUrl: string | null;
  avatarCropUrl: string | null;
  employee: {
    id: string;
    employeeNo: string;
    photoUrl?: string | null;
    address: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    salaryBankName: string | null;
    salaryBankAccount: string | null;
    department: { name: string } | null;
    position: { title: string } | null;
  } | null;
}

export function useMyProfile() {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => (await api.get<SelfProfile>('/users/me')).data,
  });
}

export function uploadMyAvatar(file: File) {
  return api.post<{ url: string; key: string }>('/users/me/avatar-upload', { fileName: file.name })
    .then(async ({ data }) => {
      const response = await fetch(data.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
      if (!response.ok) throw new Error('Avatar upload failed');
      return data.key;
    });
}

export function useUpdateMyProfile() {
  return useMutation({
    mutationFn: async (payload: { fullName?: string; email?: string; phone?: string; avatarKey?: string; avatarPortraitKey?: string; avatarCropKey?: string; salaryBankName?: string; salaryBankAccount?: string }) =>
      (await api.patch<SelfProfile>('/users/me', payload)).data,
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      (await api.post<{ success: boolean }>('/users/me/change-password', payload)).data,
  });
}
