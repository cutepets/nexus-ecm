'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Search, Settings, User } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/features/dashboard/api';
import { formatDate } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { canAccessNavItem, findNavItemForPath } from '@/lib/nav';
import { useLogout } from '@/features/auth/api';
import { useMyProfile } from '@/features/users/self-profile';
import { getAudioContextConstructor, playNotificationAudio, playNotificationTone } from '@/features/notifications/sound';
import { useNotificationPreferences } from '@/stores/notification-preferences';

/** Build initials from a full name, e.g. "Budi Santoso" → "BS". */
function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Chủ cửa hàng',
  ADMIN: 'Chủ cửa hàng',
  employee: 'Nhân viên',
  manager: 'Quản lý',
};

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canReadNotifications = hasPermission('notification:read');
  const settingsRoute = findNavItemForPath('/dashboard/pengaturan');
  const canOpenSettings = Boolean(settingsRoute && canAccessNavItem(settingsRoute, hasPermission));
  const logout = useLogout();
  const { data: profile } = useMyProfile();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { data: notifications } = useNotifications(canReadNotifications && notificationsOpen);
  const { data: unread } = useUnreadCount(canReadNotifications);
  const markAll = useMarkAllRead();
  const soundEnabled = useNotificationPreferences((state) => state.soundEnabled);
  const notificationVolume = useNotificationPreferences((state) => state.volume);
  const notificationTone = useNotificationPreferences((state) => state.tone);
  const customSoundDataUrl = useNotificationPreferences((state) => state.customSoundDataUrl);
  const previousUnreadCount = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if ('Notification' in window) setBrowserPermission(window.Notification.permission);

    const armAudio = () => {
      if (audioContext.current) return;
      const AudioContext = getAudioContextConstructor();
      if (!AudioContext) return;
      audioContext.current = new AudioContext();
      void audioContext.current.resume();
    };
    window.addEventListener('pointerdown', armAudio, { once: true });
    return () => window.removeEventListener('pointerdown', armAudio);
  }, []);

  useEffect(() => {
    if (unread === undefined) return;
    const previousCount = previousUnreadCount.current;
    previousUnreadCount.current = unread.count;
    if (previousCount === null || unread.count <= previousCount) return;

    const addedCount = unread.count - previousCount;
    toast(`${addedCount} thông báo mới`, { description: 'Mở chuông để xem nội dung.' });
    if (soundEnabled) {
      if (notificationTone === 'CUSTOM') playNotificationAudio(customSoundDataUrl, notificationVolume);
      else playNotificationTone(audioContext.current, notificationTone, notificationVolume);
    }
    if (document.hidden && 'Notification' in window && window.Notification.permission === 'granted') {
      const browserNotification = new window.Notification('Bạn có thông báo mới', {
        body: `${addedCount} thông báo chưa đọc.`,
        tag: 'nexus-unread-notifications',
      });
      browserNotification.onclick = () => window.focus();
    }
  }, [customSoundDataUrl, notificationTone, notificationVolume, soundEnabled, unread]);

  useEffect(() => {
    const auth = useAuthStore.getState();
    if (!profile || !auth.user || !auth.accessToken || !auth.refreshToken) return;
    if (auth.user.fullName === profile.fullName && auth.user.avatarUrl === profile.avatarUrl && auth.user.avatarCropUrl === profile.avatarCropUrl) return;
    setAuth({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: { ...auth.user, fullName: profile.fullName, avatarUrl: profile.avatarUrl, avatarCropUrl: profile.avatarCropUrl },
    });
  }, [profile, setAuth]);

  const openPalette = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );

  const requestBrowserNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === 'granted') toast.success('Đã bật thông báo trình duyệt');
    else toast.error('Thông báo trình duyệt chưa được cấp quyền');
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 min-w-0 items-center gap-3 border-b border-border bg-canvas/80 px-4 backdrop-blur sm:justify-between sm:px-6">
      <button
        onClick={openPalette}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink-subtle transition-colors hover:bg-card sm:w-72 sm:flex-none"
      >
        <Search className="size-4" />
        <span className="min-w-0 flex-1 truncate text-left">Tìm kiếm…</span>
        <kbd className="rounded-md border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle">
          ⌘K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {canReadNotifications && <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Thông báo"
              className="relative flex size-9 items-center justify-center rounded-xl border border-border bg-card text-ink-muted transition-colors hover:bg-canvas"
            >
              <Bell className="size-4" />
              {(unread?.count ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-accent-pink px-1 text-[10px] font-medium text-white">
                  {unread!.count > 9 ? '9+' : unread!.count}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <span className="text-xs font-medium text-ink-subtle">Thông báo</span>
              {(unread?.count ?? 0) > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-purple-700 hover:underline">
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {browserPermission !== 'unsupported' && browserPermission !== 'granted' && (
              <>
                <DropdownMenuItem onSelect={requestBrowserNotifications}>
                  Bật thông báo trên trình duyệt
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <div className="max-h-80 overflow-y-auto">
              {notifications?.length ? (
                notifications.slice(0, 12).map((n) => (
                  <div key={n.id} className={`px-2.5 py-2 ${n.isRead ? '' : 'bg-canvas/60'}`}>
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body && <div className="text-xs text-ink-muted">{n.body}</div>}
                    <div className="mt-0.5 text-[10px] text-ink-subtle">{formatDate(n.createdAt)}</div>
                  </div>
                ))
              ) : (
                <div className="px-2.5 py-6 text-center text-sm text-ink-subtle">Không có thông báo</div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>}

        {canOpenSettings && <button
          type="button"
          aria-label="Cài đặt"
          title="Cài đặt"
          onClick={() => router.push('/dashboard/pengaturan')}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <Settings className="size-4" />
        </button>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-xl border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-canvas">
              <Avatar className="size-7">
                {user?.avatarCropUrl || user?.avatarUrl ? <AvatarImage src={user.avatarCropUrl ?? user.avatarUrl ?? undefined} alt={user.fullName} /> : null}
                <AvatarFallback className="text-xs">{initials(user?.fullName)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium leading-tight">{user?.fullName}</div>
                <div className="text-xs leading-tight text-ink-subtle">
                  {user?.roles.map((role) => ROLE_LABEL[role] ?? role).join(', ')}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/dashboard/profil')}>
              <User /> Hồ sơ
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-700"
              onSelect={() =>
                logout.mutate(undefined, { onSuccess: () => router.replace('/login') })
              }
            >
              <LogOut /> Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
