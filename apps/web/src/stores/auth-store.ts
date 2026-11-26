'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { AuthUser } from '@nexus/shared';

const AUTH_STORAGE_KEY = 'nexus-auth';
const AUTH_CHANNEL_KEY = 'nexus-auth-sync';

type AuthSyncMessage =
  | { type: 'tokens'; accessToken: string; refreshToken: string }
  | { type: 'clear' };

let authChannel: BroadcastChannel | null = null;

function getAuthChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  authChannel ??= new BroadcastChannel(AUTH_CHANNEL_KEY);
  return authChannel;
}

/**
 * Keeps a normal session in sessionStorage and only uses localStorage when the
 * user explicitly opts in to remembering this device.  The returned state is
 * still JSON-compatible with Zustand's persist middleware.
 */
const authStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(name) ?? window.sessionStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    const persisted = JSON.parse(value) as { state?: { rememberMe?: boolean } };
    const target = persisted.state?.rememberMe ? window.localStorage : window.sessionStorage;
    const other = persisted.state?.rememberMe ? window.sessionStorage : window.localStorage;
    other.removeItem(name);
    target.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(name);
    window.sessionStorage.removeItem(name);
  },
};

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  setAuth: (
    data: { user: AuthUser; accessToken: string; refreshToken: string },
    rememberMe?: boolean,
  ) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      rememberMe: false,
      setAuth: ({ user, accessToken, refreshToken }, rememberMe = get().rememberMe) =>
        set({ user, accessToken, refreshToken, rememberMe }),
      setTokens: ({ accessToken, refreshToken }) => {
        set({ accessToken, refreshToken });
        getAuthChannel()?.postMessage({ type: 'tokens', accessToken, refreshToken } satisfies AuthSyncMessage);
      },
      clear: () => {
        set({ user: null, accessToken: null, refreshToken: null, rememberMe: false });
        getAuthChannel()?.postMessage({ type: 'clear' } satisfies AuthSyncMessage);
      },
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.roles.includes('ADMIN')) return true;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => authStorage),
      // Keep hydration under DashboardLayout so persisted tokens are restored
      // exactly once before the protected route can redirect.
      skipHydration: true,
    },
  ),
);

getAuthChannel()?.addEventListener('message', (event: MessageEvent<AuthSyncMessage>) => {
  if (event.data.type === 'tokens') {
    useAuthStore.setState({
      accessToken: event.data.accessToken,
      refreshToken: event.data.refreshToken,
    });
    return;
  }
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, rememberMe: false });
});
