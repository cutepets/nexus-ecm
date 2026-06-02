'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useLeaveRequests, useLeaveInbox, type LeaveRequest } from '@/features/leave/api';

const STEP_LABEL = ['', 'Supervisor', 'Manager', 'HR'];

export default function CutiPage() {
  const router = useRouter();
  const canApprove = useAuthStore((s) => s.hasPermission('leave:approve'));
  const { data: requests, isLoading } = useLeaveRequests();
  const { data: inbox, isLoading: inboxLoading } = useLeaveInbox(canApprove);

  const baseColumns = useMemo<ColumnDef<LeaveRequest>[]>(
    () => [
      {
        accessorKey: 'employee',
        header: 'Karyawan',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.employee.fullName}</div>
            <div className="text-xs text-ink-subtle">{row.original.leaveType.name}</div>
          </div>
        ),
      },
      {
        id: 'period',
        header: 'Periode',
        cell: ({ row }) => `${formatDate(row.original.startDate)} – ${formatDate(row.original.endDate)}`,
      },
      {
        id: 'step',
        header: 'Tahap',
        cell: ({ row }) =>
          row.original.status === 'PENDING' ? (
            <Badge tone="amber">Menunggu {STEP_LABEL[row.original.currentStep]}</Badge>
          ) : (
            '—'
          ),
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
        title="Cuti"
        description="Pengajuan dan persetujuan cuti"
        action={
          <Button asChild>
            <Link href="/dashboard/cuti/baru">
              <Plus /> Ajukan Cuti
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Semua Pengajuan</TabsTrigger>
          {canApprove && <TabsTrigger value="inbox">Inbox Persetujuan</TabsTrigger>}
        </TabsList>

        <TabsContent value="all">
          <DataTable
            columns={baseColumns}
            data={requests ?? []}
            loading={isLoading}
            searchPlaceholder="Cari karyawan…"
            emptyTitle="Belum ada pengajuan cuti"
            onRowClick={(r) => router.push(`/dashboard/cuti/${r.id}`)}
          />
        </TabsContent>

        {canApprove && (
          <TabsContent value="inbox">
            <DataTable
              columns={baseColumns}
              data={inbox ?? []}
              loading={inboxLoading}
              searchPlaceholder="Cari karyawan…"
              emptyTitle="Tidak ada pengajuan menunggu persetujuan"
              onRowClick={(r) => router.push(`/dashboard/cuti/${r.id}`)}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
