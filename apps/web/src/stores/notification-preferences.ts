'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationTone = 'CHIME' | 'BELL';

interface NotificationPreferencesState {
  soundEnabled: boolean;
  volume: number;
  tone: NotificationTone;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setTone: (tone: NotificationTone) => void;
}

export const useNotificationPreferences = create<NotificationPreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      volume: 75,
      tone: 'CHIME',
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
      setTone: (tone) => set({ tone }),
    }),
    {
      name: 'nexus-notification-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
