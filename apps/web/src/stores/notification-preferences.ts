'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationTone = 'CHIME' | 'BELL' | 'CUSTOM';

interface NotificationPreferencesState {
  soundEnabled: boolean;
  volume: number;
  tone: NotificationTone;
  customSoundDataUrl: string | null;
  customSoundName: string | null;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setTone: (tone: NotificationTone) => void;
  setCustomSound: (dataUrl: string | null, name: string | null) => void;
}

export const useNotificationPreferences = create<NotificationPreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      volume: 75,
      tone: 'CHIME',
      customSoundDataUrl: null,
      customSoundName: null,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
      setTone: (tone) => set({ tone }),
      setCustomSound: (customSoundDataUrl, customSoundName) =>
        set({ customSoundDataUrl, customSoundName }),
    }),
    {
      name: 'nexus-notification-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
