'use client';

import { Users, UserCheck, CalendarCheck, FolderKanban, ListTodo, Wallet, CalendarOff } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useDashboardSummary, useActivity } from '@/features/dashboard/api';

export default function DashboardPage() {
  const { data: s, isLoading } = useDashboardSummary();
  const { data: activity } = useActivity();

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Ringkasan eksekutif perusahaan Anda" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Karyawan" value={s?.totalEmployees ?? 0} icon={Users} accent="purple" loading={isLoading} />
        <KpiCard label="Karyawan Aktif" value={s?.activeEmployees ?? 0} icon={UserCheck} accent="cyan" loading={isLoading} />
        <KpiCard label="Hadir Hari Ini" value={s?.presentToday ?? 0} icon={CalendarCheck} accent="mint" loading={isLoading} />
        <KpiCard label="Proyek Aktif" value={s?.activeProjects ?? 0} icon={FolderKanban} accent="pink" loading={isLoading} />
        <KpiCard label="Tugas Berjalan" value={s?.pendingTasks ?? 0} icon={ListTodo} accent="purple" loading={isLoading} />
        <KpiCard label="Cuti Menunggu" value={s?.pendingLeaves ?? 0} icon={CalendarOff} accent="cyan" loading={isLoading} />
      </div>

      <KpiCard
        label="Pendapatan Bulan Ini"
        value={formatCurrency(s?.monthIncome ?? 0)}
        icon={Wallet}
        accent="mint"
        loading={isLoading}
      />

      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <h3 className="text-base font-medium tracking-tight">Aktivitas Terbaru</h3>
        <ul className="mt-4 divide-y divide-border">
          {activity?.length ? (
            activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="text-sm">
                  <span className="font-medium">{a.actor?.fullName ?? 'Sistem'}</span>{' '}
                  <span className="text-ink-muted">{a.entity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={a.action} />
                  <span className="hidden text-xs text-ink-subtle sm:block">{formatDate(a.createdAt)}</span>
                </div>
              </li>
            ))
          ) : (
            <li className="py-3 text-sm text-ink-subtle">Belum ada aktivitas.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
