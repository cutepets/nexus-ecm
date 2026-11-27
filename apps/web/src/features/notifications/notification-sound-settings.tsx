'use client';

import { useState } from 'react';
import { BellRing, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { getAudioContextConstructor, playNotificationAudio, playNotificationTone } from '@/features/notifications/sound';
import { useNotificationPreferences } from '@/stores/notification-preferences';

export function NotificationSoundSettings() {
  const [uploadError, setUploadError] = useState('');
  const soundEnabled = useNotificationPreferences((state) => state.soundEnabled);
  const volume = useNotificationPreferences((state) => state.volume);
  const tone = useNotificationPreferences((state) => state.tone);
  const customSoundDataUrl = useNotificationPreferences((state) => state.customSoundDataUrl);
  const customSoundName = useNotificationPreferences((state) => state.customSoundName);
  const setSoundEnabled = useNotificationPreferences((state) => state.setSoundEnabled);
  const setVolume = useNotificationPreferences((state) => state.setVolume);
  const setTone = useNotificationPreferences((state) => state.setTone);
  const setCustomSound = useNotificationPreferences((state) => state.setCustomSound);

  const preview = () => {
    if (tone === 'CUSTOM') {
      playNotificationAudio(customSoundDataUrl, soundEnabled ? volume : 0);
      return;
    }
    const AudioContext = getAudioContextConstructor();
    if (!AudioContext) return;
    const context = new AudioContext();
    void context.resume();
    playNotificationTone(context, tone, soundEnabled ? volume : 0);
    window.setTimeout(() => void context.close(), 1_200);
  };

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-accent-purple/15 p-2 text-purple-700">
          <BellRing className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-ink">Âm thanh thông báo</h2>
          <p className="text-sm text-ink-muted">
            Cài đặt này chỉ áp dụng cho trình duyệt và thiết bị hiện tại.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:max-w-xl">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-ink">Phát âm thanh khi có thông báo mới</span>
            <span className="block text-xs text-ink-muted">Áp dụng cho báo duyệt, tin nhắn và các thông báo hệ thống.</span>
          </span>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
            className="size-4 accent-purple-700"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Kiểu âm báo</span>
          <Select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)} disabled={!soundEnabled}>
            <option value="CHIME">Chuông đôi</option>
            <option value="BELL">Chuông ngân</option>
            <option value="CUSTOM" disabled={!customSoundDataUrl}>Âm thanh đã tải lên</option>
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Tải âm thanh lên</span>
          <input
            type="file"
            accept="audio/*"
            disabled={!soundEnabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith('audio/') || file.size > 2_500_000) {
                setUploadError('Chọn tệp âm thanh có dung lượng tối đa 2,5 MB.');
                event.target.value = '';
                return;
              }
              setUploadError('');
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== 'string') return;
                try {
                  setCustomSound(reader.result, file.name);
                  setTone('CUSTOM');
                } catch {
                  setUploadError('Không thể lưu tệp âm thanh trên thiết bị này.');
                }
              };
              reader.onerror = () => setUploadError('Không thể đọc tệp âm thanh.');
              reader.readAsDataURL(file);
            }}
            className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-2 file:font-medium"
          />
          {uploadError ? <span className="block text-xs text-red-600">{uploadError}</span> : null}
          {customSoundName ? (
            <span className="flex items-center justify-between gap-2 text-xs text-ink-muted">
              {customSoundName}
              <button
                type="button"
                className="font-medium text-purple-700"
                onClick={() => {
                  setCustomSound(null, null);
                  if (tone === 'CUSTOM') setTone('CHIME');
                }}
              >
                Xóa tệp
              </button>
            </span>
          ) : null}
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="notification-volume" className="flex items-center gap-2 text-sm font-medium text-ink">
              <Volume2 className="size-4" /> Âm lượng
            </label>
            <span className="text-sm tabular-nums text-ink-muted">{soundEnabled ? volume : 0}%</span>
          </div>
          <input
            id="notification-volume"
            type="range"
            min="0"
            max="100"
            step="5"
            value={volume}
            disabled={!soundEnabled}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="w-full accent-purple-700 disabled:cursor-not-allowed"
          />
        </div>

        <Button type="button" variant="secondary" className="w-fit" onClick={preview} disabled={!soundEnabled || volume === 0 || (tone === 'CUSTOM' && !customSoundDataUrl)}>
          <Volume2 /> Nghe thử
        </Button>
      </div>
    </section>
  );
}
