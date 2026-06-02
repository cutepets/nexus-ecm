'use client';

import { useRouter } from 'next/navigation';
import { Bell, LogOut, Search, Settings, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useLogout } from '@/features/auth/api';

/** Build initials from a full name, e.g. "Budi Santoso" → "BS". */
function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: notifications } = useNotifications();
  const { data: unread } = useUnreadCount();
  const markAll = useMarkAllRead();

  const openPalette = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-canvas/80 px-6 backdrop-blur">
      <button
        onClick={openPalette}
        className="flex w-72 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink-subtle transition-colors hover:bg-card"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Cari…</span>
        <kbd className="rounded-md border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Notifikasi"
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
              <span className="text-xs font-medium text-ink-subtle">Notifikasi</span>
              {(unread?.count ?? 0) > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-purple-700 hover:underline">
                  Tandai semua dibaca
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
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
                <div className="px-2.5 py-6 text-center text-sm text-ink-subtle">Tidak ada notifikasi</div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-xl border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-canvas">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials(user?.fullName)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium leading-tight">{user?.fullName}</div>
                <div className="text-xs leading-tight text-ink-subtle">
                  {user?.roles.join(', ')}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/dashboard/profil')}>
              <User /> Profil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push('/dashboard/pengaturan')}>
              <Settings /> Pengaturan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-700"
              onSelect={() =>
                logout.mutate(undefined, { onSuccess: () => router.replace('/login') })
              }
            >
              <LogOut /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
