'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, ScanFace, UserCheck, Clock, CalendarOff, FileQuestion, UserX } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard } from '@/components/charts/chart-card';
import { BarChart } from '@/components/charts/bar-chart';
import { Button } from '@/components/ui/button';
import { useAttendanceList, useAttendanceSummary, type AttendanceRecord } from '@/features/attendance/api';

function timeOf(v?: string | null) {
  return v ? new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function AbsensiPage() {
  const { data: summary } = useAttendanceSummary();
  const { data: list, isLoading } = useAttendanceList();

  const counts = summary?.counts ?? {};
  const chartData = useMemo(
    () => [
      { label: 'Hadir', jumlah: counts.PRESENT ?? 0 },
      { label: 'Terlambat', jumlah: counts.LATE ?? 0 },
      { label: 'Cuti', jumlah: counts.LEAVE ?? 0 },
      { label: 'Izin', jumlah: counts.PERMIT ?? 0 },
      { label: 'Absen', jumlah: counts.ABSENT ?? 0 },
    ],
    [counts],
  );

  const columns = useMemo<ColumnDef<AttendanceRecord>[]>(
    () => [
      {
        accessorKey: 'employee',
        header: 'Karyawan',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.employee.fullName}</div>
            <div className="text-xs text-ink-subtle">{row.original.employee.employeeNo}</div>
          </div>
        ),
      },
      { id: 'in', header: 'Masuk', cell: ({ row }) => timeOf(row.original.checkInAt) },
      { id: 'out', header: 'Keluar', cell: ({ row }) => timeOf(row.original.checkOutAt) },
      {
        accessorKey: 'matchScore',
        header: 'Kecocokan',
        cell: ({ row }) =>
          row.original.matchScore != null ? `${Math.round(row.original.matchScore * 100)}%` : '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi"
        description="Kehadiran hari ini dengan pengenalan wajah"
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/dashboard/absensi/enroll">
                <ScanFace /> Daftar Wajah
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/absensi/check-out">
                <LogOut /> Check-out
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/absensi/check-in">
                <LogIn /> Check-in
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Hadir" value={counts.PRESENT ?? 0} icon={UserCheck} accent="mint" />
        <KpiCard label="Terlambat" value={counts.LATE ?? 0} icon={Clock} accent="pink" />
        <KpiCard label="Cuti" value={counts.LEAVE ?? 0} icon={CalendarOff} accent="purple" />
        <KpiCard label="Izin" value={counts.PERMIT ?? 0} icon={FileQuestion} accent="cyan" />
        <KpiCard label="Absen" value={counts.ABSENT ?? 0} icon={UserX} accent="pink" />
      </div>

      <ChartCard title="Ringkasan Kehadiran Hari Ini" description={summary?.date}>
        <BarChart data={chartData} xKey="label" series={[{ key: 'jumlah', label: 'Jumlah' }]} />
      </ChartCard>

      <div>
        <h3 className="mb-3 text-base font-medium">Catatan Hari Ini</h3>
        <DataTable
          columns={columns}
          data={list ?? []}
          loading={isLoading}
          searchPlaceholder="Cari karyawan…"
          emptyTitle="Belum ada catatan absensi hari ini"
        />
      </div>
    </div>
  );
}
