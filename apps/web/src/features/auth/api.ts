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

interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async ({ rememberMe, ...creds }: LoginCredentials) => {
      const { data } = await api.post<LoginResponse>('/auth/login', creds);
      return { ...data, rememberMe };
    },
    onSuccess: ({ rememberMe, ...data }) => {
      if (typeof window !== 'undefined') sessionStorage.removeItem(`password-change-dismissed:${data.user.id}`);
      setAuth(data, rememberMe);
    },
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
