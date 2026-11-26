'use client';

import { useMemo } from 'react';
import { Users, UserCheck, CalendarCheck, FolderKanban, ListTodo, CalendarOff, Clock, UserX } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardSummary } from '@/features/dashboard/api';
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

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" description="Tóm tắt điều hành của công ty" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Tổng nhân viên" value={s?.totalEmployees ?? 0} icon={Users} accent="purple" loading={isLoading} />
        <KpiCard label="Nhân viên đang làm việc" value={s?.activeEmployees ?? 0} icon={UserCheck} accent="cyan" loading={isLoading} />
        <KpiCard label="Có mặt hôm nay" value={s?.presentToday ?? 0} icon={CalendarCheck} accent="mint" loading={isLoading} />
        <KpiCard label="Dự án đang hoạt động" value={s?.activeProjects ?? 0} icon={FolderKanban} accent="pink" loading={isLoading} />
        <KpiCard label="Công việc đang xử lý" value={s?.pendingTasks ?? 0} icon={ListTodo} accent="purple" loading={isLoading} />
        <KpiCard label="Đơn nghỉ phép chờ duyệt" value={s?.pendingLeaves ?? 0} icon={CalendarOff} accent="cyan" loading={isLoading} />
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
      <PageHeader title={`Xin chào, ${user?.fullName ?? ''}`} description="Tóm tắt công việc của bạn" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Hadir (bln ini)" value={counts.PRESENT ?? 0} icon={UserCheck} accent="mint" />
        <KpiCard label="Đi muộn" value={counts.LATE ?? 0} icon={Clock} accent="pink" />
        <KpiCard label="Công việc đang xử lý" value={openTasks.length} icon={ListTodo} accent="purple" />
        <KpiCard label="Phép năm còn lại" value={annualRemaining ?? '—'} icon={CalendarOff} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h3 className="mb-3 text-base font-medium">Công việc của tôi</h3>
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
            <p className="text-sm text-ink-subtle">Không có công việc đang xử lý. 🎉</p>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h3 className="mb-3 text-base font-medium">Đơn nghỉ phép của tôi</h3>
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
            <p className="text-sm text-ink-subtle">Chưa có đơn nghỉ phép.</p>
          )}
          {pendingLeaves.length > 0 && (
            <p className="mt-3 text-xs text-ink-subtle">{pendingLeaves.length} đơn đang chờ phê duyệt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
