import type { NotificationTone } from '@/stores/notification-preferences';

export type AudioContextConstructor = new () => AudioContext;

export function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const supported = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? supported.webkitAudioContext ?? null;
}

/** Plays a clear two-note notification. Volume is a user-facing 0–100 value. */
export function playNotificationTone(
  context: AudioContext | null,
  tone: NotificationTone,
  volume: number,
) {
  if (!context || volume <= 0) return;

  const start = context.currentTime;
  const peak = Math.max(0.0001, Math.min(0.28, (volume / 100) * 0.28));
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const isBell = tone === 'BELL';
  const duration = isBell ? 0.9 : 0.68;

  oscillator.type = isBell ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(isBell ? 988 : 784, start);
  oscillator.frequency.setValueAtTime(isBell ? 1_318 : 1_047, start + 0.24);
  if (isBell) oscillator.frequency.setValueAtTime(988, start + 0.49);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(peak * 0.72, start + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}
