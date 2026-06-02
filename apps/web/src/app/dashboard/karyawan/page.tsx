'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { useEmployees, useDepartments } from '@/features/employees/api';
import type { EmployeeListItem } from '@nexus/shared';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function KaryawanPage() {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState('');
  const [workStatus, setWorkStatus] = useState('');

  const { data: departments } = useDepartments();
  const { data, isLoading } = useEmployees({
    pageSize: 100,
    departmentId: departmentId || undefined,
    workStatus: workStatus || undefined,
  });

  const columns = useMemo<ColumnDef<EmployeeListItem>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Nama',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(row.original.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{row.original.fullName}</div>
              <div className="text-xs text-ink-subtle">{row.original.employeeNo}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'department',
        header: 'Departemen',
        cell: ({ row }) => row.original.department?.name ?? '—',
      },
      {
        accessorKey: 'position',
        header: 'Jabatan',
        cell: ({ row }) => row.original.position?.title ?? '—',
      },
      {
        accessorKey: 'workStatus',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.workStatus} />,
      },
      {
        accessorKey: 'joinDate',
        header: 'Bergabung',
        cell: ({ row }) => formatDate(row.original.joinDate),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Karyawan"
        description={`${data?.total ?? 0} karyawan terdaftar`}
        action={
          <Button asChild>
            <Link href="/dashboard/karyawan/baru">
              <Plus /> Tambah Karyawan
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="w-auto"
        >
          <option value="">Semua Departemen</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={workStatus} onChange={(e) => setWorkStatus(e.target.value)} className="w-auto">
          <option value="">Semua Status</option>
          <option value="PROBATION">Probation</option>
          <option value="PERMANENT">Tetap</option>
          <option value="CONTRACT">Kontrak</option>
          <option value="INACTIVE">Nonaktif</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        searchPlaceholder="Cari nama, NIK, email…"
        emptyTitle="Belum ada karyawan"
        emptyDescription="Tambahkan karyawan pertama untuk memulai."
        onRowClick={(row) => router.push(`/dashboard/karyawan/${row.id}`)}
      />
    </div>
  );
}
