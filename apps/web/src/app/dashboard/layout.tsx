'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { CommandPalette } from '@/components/shell/command-palette';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { PasswordOnboardingDialog } from '@/features/auth/password-onboarding-dialog';
import { canAccessNavItem, findNavItemForPath } from '@/lib/nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const routeItem = findNavItemForPath(pathname);
  const canViewRoute = !routeItem || canAccessNavItem(routeItem, hasPermission);
  const database = useQuery({
    queryKey: ['system', 'database-health'],
    queryFn: async () => (await api.get<{ db: 'up' | 'down' }>('/health/ready', { timeout: 3000 })).data,
    enabled: hydrated && Boolean(accessToken) && canViewRoute,
    retry: 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // The auth store can restore from sessionStorage or localStorage. Do not
    // treat the first client render as ready: it may still contain the server
    // defaults and cause the dashboard to get stuck behind the loading state.
    const finishHydration = () => setHydrated(true);
    const unsubscribe = useAuthStore.persist.onFinishHydration(finishHydration);
    if (useAuthStore.persist.hasHydrated()) finishHydration();
    else {
      void Promise.resolve(useAuthStore.persist.rehydrate()).catch(() => {
        // A manually edited/corrupt browser value must not permanently block
        // the dashboard; discard it and let the normal login redirect run.
        useAuthStore.persist.clearStorage();
        finishHydration();
      });
    }
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated || accessToken) return;
    // Prefer App Router navigation. The page-load fallback is needed for
    // embedded previews where client-side navigation can be intercepted.
    router.replace('/login');
    const fallback = window.setTimeout(() => {
      if (window.location.pathname.startsWith('/dashboard')) window.location.assign('/login');
    }, 500);
    return () => window.clearTimeout(fallback);
  }, [accessToken, hydrated, router]);

  useEffect(() => {
    if (hydrated && accessToken && !canViewRoute) router.replace('/dashboard');
  }, [accessToken, canViewRoute, hydrated, router]);

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6" aria-live="polite">
        <p className="text-sm text-ink-muted">Đang kiểm tra phiên đăng nhập…</p>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6" aria-live="polite">
        <p className="text-sm text-ink-muted">Phiên đăng nhập không còn. Đang chuyển đến trang đăng nhập…</p>
        <Link href="/login" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
          Đăng nhập ngay
        </Link>
      </main>
    );
  }

  if (!canViewRoute) return null;

  if (database.isLoading && !database.data) {
    return <main className="flex min-h-screen items-center justify-center p-6"><p className="text-sm text-ink-muted">Đang kiểm tra kết nối cơ sở dữ liệu…</p></main>;
  }

  if (!database.data || database.isError || database.data.db !== 'up') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-red-200 bg-card p-6 text-center shadow-card">
          <h1 className="text-lg font-semibold text-ink">Không kết nối được cơ sở dữ liệu</h1>
          <p className="mt-2 text-sm text-ink-muted">Để tránh hiển thị dữ liệu cũ, nội dung hệ thống đang được ẩn. Kiểm tra kết nối rồi thử lại.</p>
          <Button className="mt-4" onClick={() => void database.refetch()}>Thử lại</Button>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <Sidebar />
      <CommandPalette />
      <PasswordOnboardingDialog />
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:ml-60">
        <Topbar />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
