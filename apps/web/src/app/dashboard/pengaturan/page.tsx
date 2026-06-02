'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useAuditLogs, type AuditLog } from '@/features/dashboard/api';

export default function PengaturanPage() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const { data: logs, isLoading } = useAuditLogs({ entity: entity || undefined, action: action || undefined });

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      { id: 'actor', header: 'Aktor', cell: ({ row }) => row.original.actor?.fullName ?? 'Sistem' },
      { accessorKey: 'action', header: 'Aksi', cell: ({ row }) => <StatusBadge status={row.original.action} /> },
      { accessorKey: 'entity', header: 'Entitas', cell: ({ row }) => <span className="font-medium">{row.original.entity}</span> },
      { id: 'entityId', header: 'ID', cell: ({ row }) => <span className="text-xs text-ink-subtle">{row.original.entityId ?? '—'}</span> },
      { id: 'when', header: 'Waktu', cell: ({ row }) => formatDate(row.original.createdAt) },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Log audit sistem (siapa mengubah apa)" />

      <div className="flex flex-wrap gap-3">
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-auto">
          <option value="">Semua Entitas</option>
          {['Employee', 'Attendance', 'LeaveRequest', 'Project', 'Task', 'Invoice', 'Expense', 'Item', 'Document', 'Customer'].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-auto">
          <option value="">Semua Aksi</option>
          {['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </div>

      <DataTable columns={columns} data={logs ?? []} loading={isLoading} searchPlaceholder="Cari log…" emptyTitle="Belum ada log audit" />
    </div>
  );
}
