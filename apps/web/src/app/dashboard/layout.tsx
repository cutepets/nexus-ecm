'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { CommandPalette } from '@/components/shell/command-palette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <CommandPalette />
      <div className="flex-1 md:ml-60">
        <Topbar />
        <main className="mx-auto max-w-7xl p-6">{children}</main>
      </div>
    </div>
  );
}
