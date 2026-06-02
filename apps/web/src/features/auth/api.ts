'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthUser } from '@nexus/shared';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse>('/auth/login', creds);
      return data;
    },
    onSuccess: (data) => setAuth(data),
  });
}

export function useLogout() {
  const { refreshToken, clear } = useAuthStore.getState();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout', { refreshToken });
      } finally {
        clear();
      }
    },
  });
}
