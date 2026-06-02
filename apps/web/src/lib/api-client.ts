'use client';

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({ baseURL, withCredentials: false });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Refresh-token rotation on 401 ---
let isRefreshing = false;
let queue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function flushQueue(error: unknown, token: string | null) {
  queue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  queue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const { refreshToken, setTokens, clear } = useAuthStore.getState();

    const isAuthRoute = original?.url?.includes('/auth/');
    if (error.response?.status !== 401 || original._retry || isAuthRoute || !refreshToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Wait for the in-flight refresh, then retry.
      return new Promise((resolve, reject) => {
        queue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      flushQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (err) {
      flushQueue(err, null);
      clear();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
