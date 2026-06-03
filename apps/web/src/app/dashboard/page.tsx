'use client';

import { useMemo } from 'react';
import { Users, UserCheck, CalendarCheck, FolderKanban, ListTodo, Wallet, CalendarOff, Clock, UserX } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardSummary, useActivity } from '@/features/dashboard/api';
import { useMyAttendanceSummary } from '@/features/attendance/api';
import { useTasks } from '@/features/tasks/api';
import { useLeaveBalances, useLeaveRequests } from '@/features/leave/api';

export default function DashboardPage() {
  const canSeeCompany = useAuthStore((s) => s.hasPermission('employee:read'));
  return canSeeCompany ? <CompanyDashboard /> : <PersonalDashboard />;
}

// ---- Executive (HR/Admin/Manager) ----
function CompanyDashboard() {
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
      <KpiCard label="Pendapatan Bulan Ini" value={formatCurrency(s?.monthIncome ?? 0)} icon={Wallet} accent="mint" loading={isLoading} />
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

// ---- Self-service (employee) ----
function PersonalDashboard() {
  const user = useAuthStore((s) => s.user);
  const employeeId = user?.employeeId ?? '';
  const { data: att } = useMyAttendanceSummary();
  const { data: myTasks } = useTasks({ assigneeId: employeeId });
  const { data: balances } = useLeaveBalances(employeeId);
  const { data: leaves } = useLeaveRequests();

  const counts = att?.counts ?? {};
  const openTasks = useMemo(() => (myTasks ?? []).filter((t) => t.status !== 'DONE'), [myTasks]);
  const pendingLeaves = useMemo(() => (leaves ?? []).filter((l) => l.status === 'PENDING'), [leaves]);
  const annualRemaining = balances?.find((b) => b.leaveType.name.toLowerCase().includes('tahunan'))?.remaining;

  return (
    <div className="space-y-6">
      <PageHeader title={`Halo, ${user?.fullName ?? ''}`} description="Ringkasan performa Anda" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Hadir (bln ini)" value={counts.PRESENT ?? 0} icon={UserCheck} accent="mint" />
        <KpiCard label="Terlambat" value={counts.LATE ?? 0} icon={Clock} accent="pink" />
        <KpiCard label="Tugas Aktif" value={openTasks.length} icon={ListTodo} accent="purple" />
        <KpiCard label="Sisa Cuti Tahunan" value={annualRemaining ?? '—'} icon={CalendarOff} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h3 className="mb-3 text-base font-medium">Tugas Saya</h3>
          {openTasks.length ? (
            <ul className="divide-y divide-border">
              {openTasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{t.title}</span>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">Tidak ada tugas aktif. 🎉</p>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h3 className="mb-3 text-base font-medium">Pengajuan Cuti Saya</h3>
          {leaves?.length ? (
            <ul className="divide-y divide-border">
              {leaves.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{l.leaveType.name} · {formatDate(l.startDate)}</span>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">Belum ada pengajuan cuti.</p>
          )}
          {pendingLeaves.length > 0 && (
            <p className="mt-3 text-xs text-ink-subtle">{pendingLeaves.length} pengajuan menunggu persetujuan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
