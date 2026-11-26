'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { CommandPalette } from '@/components/shell/command-palette';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { PasswordOnboardingDialog } from '@/features/auth/password-onboarding-dialog';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const database = useQuery({
    queryKey: ['system', 'database-health'],
    queryFn: async () => (await api.get<{ db: 'up' | 'down' }>('/health/ready', { timeout: 3000 })).data,
    enabled: hydrated && Boolean(accessToken),
    retry: 0,
    staleTime: 0,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
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
    <div className="flex min-h-screen">
      <Sidebar />
      <CommandPalette />
      <PasswordOnboardingDialog />
      <div className="flex-1 md:ml-60">
        <Topbar />
        <main className="w-full p-6">{children}</main>
      </div>
    </div>
  );
}
