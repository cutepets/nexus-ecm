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

const STEP_LABEL = ['', 'Quản lý trực tiếp', 'Quản lý', 'Nhân sự'];

export default function CutiPage() {
  const router = useRouter();
  const canApprove = useAuthStore((s) => s.hasPermission('leave:approve'));
  const { data: requests, isLoading } = useLeaveRequests();
  const { data: inbox, isLoading: inboxLoading } = useLeaveInbox(canApprove);

  const baseColumns = useMemo<ColumnDef<LeaveRequest>[]>(
    () => [
      {
        accessorKey: 'employee',
        header: 'Nhân viên',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.employee.fullName}</div>
            <div className="text-xs text-ink-subtle">{row.original.leaveType.name}</div>
          </div>
        ),
      },
      {
        id: 'period',
        header: 'Thời gian nghỉ',
        cell: ({ row }) => `${formatDate(row.original.startDate)} – ${formatDate(row.original.endDate)}`,
      },
      {
        id: 'step',
        header: 'Bước duyệt',
        cell: ({ row }) =>
          row.original.status === 'PENDING' ? (
            <Badge tone="amber">Chờ {STEP_LABEL[row.original.currentStep]}</Badge>
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
        title="Nghỉ phép"
        description="Gửi và phê duyệt đơn nghỉ phép"
        action={
          <Button asChild>
            <Link href="/dashboard/cuti/baru">
              <Plus /> Tạo đơn nghỉ phép
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tất cả đơn</TabsTrigger>
          {canApprove && <TabsTrigger value="inbox">Đơn chờ duyệt</TabsTrigger>}
        </TabsList>

        <TabsContent value="all">
          <DataTable
            columns={baseColumns}
            data={requests ?? []}
            loading={isLoading}
            searchPlaceholder="Tìm nhân viên…"
            emptyTitle="Chưa có đơn nghỉ phép"
            onRowClick={(r) => router.push(`/dashboard/cuti/${r.id}`)}
          />
        </TabsContent>

        {canApprove && (
          <TabsContent value="inbox">
            <DataTable
              columns={baseColumns}
              data={inbox ?? []}
              loading={inboxLoading}
              searchPlaceholder="Tìm nhân viên…"
              emptyTitle="Không có đơn đang chờ duyệt"
              onRowClick={(r) => router.push(`/dashboard/cuti/${r.id}`)}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
