'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, UserCheck, CalendarCheck, FolderKanban, ListTodo, CalendarOff, Clock, MapPin, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardSummary } from '@/features/dashboard/api';
import { useAttendanceList, useMyAttendanceSummary } from '@/features/attendance/api';
import { useTasks } from '@/features/tasks/api';
import { useLeaveBalances, useLeaveRequests } from '@/features/leave/api';
import { useWorkRoster, type RosterEntry } from '@/features/attendance/work-roster-api';

export default function DashboardPage() {
  const canSeeCompany = useAuthStore((s) => s.hasPermission('dashboard:read'));
  return canSeeCompany ? <CompanyDashboard /> : <PersonalDashboard />;
}

// ---- Executive (HR/Admin/Manager) ----
function CompanyDashboard() {
  const { data: s, isLoading } = useDashboardSummary();
  const canReadAttendance = useAuthStore((state) => state.hasPermission('attendance:read'));
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = `${month}-${String(now.getDate()).padStart(2, '0')}`;
  const { data: roster, isLoading: rosterLoading } = useWorkRoster(month, canReadAttendance);
  const { data: attendanceToday } = useAttendanceList(today, canReadAttendance);
  const attendanceByEmployee = new Map((attendanceToday ?? [])
    .filter((record) => !record.isScheduledPlaceholder)
    .map((record) => [record.employee.id, record]));
  const todayEntries = (roster?.entries ?? []).filter((entry) => entry.workDate.slice(0, 10) === today);
  const branchGroups = new Map<string, { name: string; entries: Array<{ entry: RosterEntry; times: string[] }> }>();
  todayEntries.forEach((entry) => {
    const segmentsByBranch = new Map<string, { name: string; times: string[] }>();
    entry.segments.forEach((segment) => {
      const branch = segmentsByBranch.get(segment.branch.id) ?? { name: segment.branch.name, times: [] };
      branch.times.push(`${segment.startTime}–${segment.endTime}`);
      segmentsByBranch.set(segment.branch.id, branch);
    });
    segmentsByBranch.forEach((branch, branchId) => {
      const group = branchGroups.get(branchId) ?? { name: branch.name, entries: [] };
      group.entries.push({ entry, times: branch.times });
      branchGroups.set(branchId, group);
    });
  });
  const branchList = [...branchGroups.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  return (
    <div className="space-y-5">
      <PageHeader title="Tổng quan" description={`Điều hành công ty · ${now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Tổng nhân viên" value={s?.totalEmployees ?? 0} icon={Users} accent="purple" loading={isLoading} />
        <KpiCard label="Đang làm việc" value={s?.activeEmployees ?? 0} icon={UserCheck} accent="cyan" loading={isLoading} />
        <KpiCard label="Có mặt hôm nay" value={s?.presentToday ?? 0} icon={CalendarCheck} accent="mint" loading={isLoading} />
        <KpiCard label="Dự án hoạt động" value={s?.activeProjects ?? 0} icon={FolderKanban} accent="pink" loading={isLoading} />
        <KpiCard label="Công việc đang xử lý" value={s?.pendingTasks ?? 0} icon={ListTodo} accent="purple" loading={isLoading} />
        <KpiCard label="Nghỉ phép chờ duyệt" value={s?.pendingLeaves ?? 0} icon={CalendarOff} accent="cyan" loading={isLoading} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Ca làm hôm nay</h2>
              <p className="mt-1 text-sm text-ink-muted">Lịch nhân sự theo chi nhánh và khung giờ</p>
            </div>
            <Link href="/dashboard/kalender" className="inline-flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-2 text-sm font-medium text-ink hover:bg-accent-purple/10">
              Mở lịch làm việc <ArrowRight className="size-4" />
            </Link>
          </div>
          {!canReadAttendance ? (
            <div className="mt-4 rounded-xl bg-canvas px-4 py-5 text-sm text-ink-muted">Tài khoản chưa được cấp quyền xem lịch ca.</div>
          ) : rosterLoading ? (
            <div className="mt-4 space-y-2"><div className="h-16 animate-pulse rounded-xl bg-canvas" /><div className="h-16 animate-pulse rounded-xl bg-canvas" /></div>
          ) : branchList.length ? (
            <div className="mt-4 space-y-3">
              {branchList.map((branch) => (
                <div key={branch.name} className="rounded-xl border border-border/80 bg-canvas/50 p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold"><MapPin className="size-4 shrink-0 text-purple-600" />{branch.name}</h3>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-ink-muted">{branch.entries.length} nhân sự</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {branch.entries.map(({ entry, times }, index) => {
                      const attendance = attendanceByEmployee.get(entry.employee.id);
                      const statusLabel = !attendance
                        ? 'Chưa đến'
                        : attendance.status === 'PRESENT'
                          ? 'Có mặt'
                          : attendance.status === 'LATE'
                            ? 'Đi muộn'
                            : attendance.status;
                      const statusTone = !attendance
                        ? 'neutral'
                        : attendance.status === 'PRESENT'
                          ? 'mint'
                          : attendance.status === 'LATE'
                            ? 'amber'
                            : attendance.status === 'ABSENT'
                              ? 'red'
                              : attendance.status === 'LEAVE'
                                ? 'purple'
                                : 'cyan';
                      return (
                        <div key={entry.id + "-" + index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg bg-white px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{entry.employee.fullName}</p>
                            <p className="truncate text-xs text-ink-muted">{entry.scheduleName} · {times.join(' · ')}</p>
                          </div>
                          <div className="flex min-w-20 flex-col items-end gap-1">
                            <Badge tone={statusTone}>{statusLabel}</Badge>
                            <p className="text-right text-xs tabular-nums text-ink-muted">
                              In {attendance?.checkInAt ? new Date(attendance.checkInAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                            <p className="text-right text-xs tabular-nums text-ink-muted">
                              Out {attendance?.checkOutAt ? new Date(attendance.checkOutAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                          </div>
                        </div>
                      );                    })}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-ink-muted">
                <span>{todayEntries.length} ca đã xếp</span><span>{branchList.length} chi nhánh có ca</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-canvas/50 px-4 py-8 text-center">
              <CalendarCheck className="mx-auto size-7 text-ink-subtle" />
              <p className="mt-2 text-sm font-medium">Chưa có ca được xếp cho hôm nay</p>
              <p className="mt-1 text-xs text-ink-muted">Kiểm tra lịch roster để cập nhật ca cho các chi nhánh.</p>
            </div>
          )}
        </section>
        <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-base font-semibold">Việc cần theo dõi</h2>
          <p className="mt-1 text-sm text-ink-muted">Các đầu việc vận hành đang mở</p>
          <div className="mt-4 space-y-2">
            <Link href="/dashboard/phe-duyet" className="flex items-center justify-between gap-3 rounded-xl bg-canvas/70 p-3 hover:bg-accent-purple/10">
              <span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent-cyan/20 text-cyan-700"><CalendarOff className="size-4" /></span><span className="text-sm font-medium">Đơn nghỉ chờ duyệt</span></span><span className="text-lg font-semibold tabular-nums">{s?.pendingLeaves ?? '—'}</span>
            </Link>
            <Link href="/dashboard/tugas" className="flex items-center justify-between gap-3 rounded-xl bg-canvas/70 p-3 hover:bg-accent-purple/10">
              <span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent-purple/15 text-purple-700"><ListTodo className="size-4" /></span><span className="text-sm font-medium">Công việc chưa hoàn tất</span></span><span className="text-lg font-semibold tabular-nums">{s?.pendingTasks ?? '—'}</span>
            </Link>
            <Link href="/dashboard/absensi" className="flex items-center justify-between gap-3 rounded-xl bg-canvas/70 p-3 hover:bg-accent-mint/20">
              <span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent-mint/20 text-emerald-700"><Clock className="size-4" /></span><span className="text-sm font-medium">Chấm công hôm nay</span></span><span className="text-sm font-semibold">{s?.presentToday ?? '—'} / {s?.activeEmployees ?? '—'} có mặt</span>
            </Link>
          </div>
          <div className="mt-4 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between text-xs text-ink-muted"><span>Tiến độ hiện diện</span><span>{s?.activeEmployees ? Math.round(((s.presentToday ?? 0) / s.activeEmployees) * 100) : 0}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${s?.activeEmployees ? Math.min(100, ((s.presentToday ?? 0) / s.activeEmployees) * 100) : 0}%` }} /></div>
          </div>
        </section>
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
