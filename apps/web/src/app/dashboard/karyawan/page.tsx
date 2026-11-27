'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ScanFace, Search } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { useEmployees, useDepartments, useEmployeeBranches } from '@/features/employees/api';
import { useAuthStore } from '@/stores/auth-store';
import type { EmployeeListItem } from '@nexus/shared';
import { EmployeeExcelActions } from '@/features/employees/employee-excel-actions';
import { EnrollScanner } from '@/features/attendance/enroll-scanner';
import { employeeDateMarker } from '@/features/employees/employee-date-marker';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}

function formatTenure(joinDate: string, exitDate?: string | null) {
  const toCalendarDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
  };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const start = toCalendarDate(joinDate);
  const end = toCalendarDate(exitDate ?? today);
  if (!start || !end) return '—';
  if (end.getTime() < start.getTime()) return '—';
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) return '—';
  if (months === 0) return `${Math.floor((end.getTime() - start.getTime()) / 86_400_000)} ngày`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return [years ? `${years} năm` : null, remainingMonths ? `${remainingMonths} tháng` : null].filter(Boolean).join(' ');
}

function tenureDaysUnderOneMonth(employee: EmployeeListItem) {
  const tenure = formatTenure(employee.joinDate, employee.exitDate);
  return tenure.endsWith(' ngày') ? Number(tenure.split(' ')[0]) : null;
}

function daysUntilExit(exitDate?: string | null) {
  if (!exitDate) return null;
  const toCalendarDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
  };
  const todayText = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const today = toCalendarDate(todayText);
  const end = toCalendarDate(exitDate);
  if (!today || !end || end.getTime() < today.getTime()) return null;
  return Math.floor((end.getTime() - today.getTime()) / 86_400_000);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const EMPLOYEE_HIDDEN_COLUMNS: Record<string, boolean> = {
  username: false,
  email: false,
  phone: false,
  gender: false,
  dateOfBirth: false,
  identityCode: false,
  address: false,
  emergencyContactName: false,
  emergencyContactPhone: false,
  taxCode: false,
  basicSalary: false,
  spaBonusPercent: false,
  salaryBankName: false,
  salaryBankAccount: false,
  jobTitle: false,
  employmentType: false,
  primaryBranch: false,
  branchAssignments: false,
  workScheduleAssignments: false,
  exitDate: false,
  accountEmail: false,
  accountRoles: false,
  accountStatus: false,
  lastLoginAt: false,
};

export default function KaryawanPage() {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState('');
  const [workStatus, setWorkStatus] = useState('DEFAULT');
  const isUpcomingExitFilter = workStatus === 'UPCOMING_EXIT';
  const includesUpcomingExit = workStatus === 'DEFAULT' || isUpcomingExitFilter;
  const statusFilter = workStatus === 'DEFAULT' ? 'PROBATION,PERMANENT,ON_LEAVE' : isUpcomingExitFilter ? undefined : workStatus || undefined;
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [faceEmployee, setFaceEmployee] = useState<EmployeeListItem | null>(null);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = hasPermission('employee:create');
  const canUpdate = hasPermission('employee:update');
  const canEnrollFace = hasPermission('attendance:face:enroll');
  const canReadPayroll = hasPermission('payroll:read');

  const { data: departments } = useDepartments();
  const { data: branches } = useEmployeeBranches();
  const { data, isLoading, isError } = useEmployees({
    pageSize: 100,
    departmentId: departmentId || undefined,
    workStatus: statusFilter,
    upcomingExit: includesUpcomingExit || undefined,
    branchId: branchId || undefined,
  });
  const filteredEmployees = useMemo(() => {
    const items = isError ? [] : data?.items ?? [];
    const query = search.trim().toLocaleLowerCase('vi-VN');
    if (!query) return items;
    return items.filter((employee) => [employee.fullName, employee.employeeNo, employee.email]
      .some((value) => value?.toLocaleLowerCase('vi-VN').includes(query)));
  }, [data?.items, isError, search]);

  const columns = useMemo<ColumnDef<EmployeeListItem>[]>(
    () => [
      {
        accessorKey: 'employeeNo',
        header: 'Mã nhân viên',
        size: 120,
      },
      {
        accessorKey: 'fullName',
        header: 'Họ và tên',
        size: 220,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="relative shrink-0">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(row.original.fullName)}</AvatarFallback>
              </Avatar>
              {(() => {
                const marker = employeeDateMarker(row.original.joinDate, row.original.exitDate);
                return marker && <span className={`absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold ${marker.tone === 'rose' ? 'bg-rose-200 text-rose-800' : 'bg-amber-100 text-amber-900'}`} title={marker.title}>{marker.value}</span>;
              })()}
            </span>
            <div>
              <div className="font-medium">{row.original.fullName}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'department',
        header: 'Phòng ban',
        cell: ({ row }) => row.original.department?.name ?? '—',
      },
      {
        accessorKey: 'position',
        header: 'Chức danh',
        cell: ({ row }) => row.original.position?.title ?? '—',
      },
      {
        accessorKey: 'workStatus',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const upcoming = daysUntilExit(row.original.exitDate) !== null;
          return <StatusBadge status={upcoming ? 'UPCOMING_EXIT' : row.original.workStatus} label={upcoming ? 'Sắp nghỉ' : row.original.workStatus === 'INACTIVE' ? 'Thôi việc' : undefined} />;
        },
      },
      {
        accessorKey: 'joinDate',
        header: 'Ngày vào làm',
        cell: ({ row }) => formatDateOnly(row.original.joinDate),
      },
      {
        id: 'tenure',
        header: 'Thâm niên',
        accessorFn: (row) => formatTenure(row.joinDate, row.exitDate),
        cell: ({ row }) => <span className={tenureDaysUnderOneMonth(row.original) !== null ? 'rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-900' : ''}>{formatTenure(row.original.joinDate, row.original.exitDate)}</span>,
      },
      {
        id: 'username',
        header: 'Tên đăng nhập',
        accessorFn: (row) => row.user?.username ?? null,
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'phone',
        header: 'Điện thoại',
      },
      {
        id: 'gender',
        header: 'Giới tính',
        accessorFn: (row) => ({ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác', UNDISCLOSED: 'Không muốn nêu' } as Record<string, string>)[row.gender ?? ''] ?? '—',
      },
      {
        id: 'dateOfBirth',
        header: 'Ngày sinh',
        accessorFn: (row) => row.dateOfBirth ? formatDateOnly(row.dateOfBirth) : '—',
      },
      {
        accessorKey: 'identityCode',
        header: 'CCCD / CMND',
      },
      {
        accessorKey: 'address',
        header: 'Địa chỉ',
      },
      {
        accessorKey: 'emergencyContactName',
        header: 'Người liên hệ khẩn cấp',
      },
      {
        accessorKey: 'emergencyContactPhone',
        header: 'SĐT liên hệ khẩn cấp',
      },
      {
        accessorKey: 'jobTitle',
        header: 'Chức danh',
      },
      {
        id: 'employmentType',
        header: 'Loại hình làm việc',
        accessorFn: (row) => row.employmentType === 'FULL_TIME' ? 'Full Time' : row.employmentType === 'PART_TIME' ? 'Part Time' : '—',
      },
      {
        id: 'primaryBranch',
        header: 'Chi nhánh chính',
        accessorFn: (row) => row.primaryBranch?.name ?? '—',
      },
      {
        id: 'branchAssignments',
        header: 'Các chi nhánh',
        accessorFn: (row) => row.branchAssignments?.map(({ branch }) => branch.name).join(', ') ?? '—',
      },
      {
        id: 'workScheduleAssignments',
        header: 'Ca làm',
        accessorFn: (row) => row.workScheduleAssignments?.map(({ workSchedule }) => `${workSchedule.name} (${workSchedule.startTime}–${workSchedule.endTime})`).join(', ') ?? '—',
      },
      {
        id: 'exitDate',
        header: 'Ngày nghỉ việc',
        accessorFn: (row) => row.exitDate ? formatDateOnly(row.exitDate) : '—',
      },
      {
        id: 'accountEmail',
        header: 'Email tài khoản',
        accessorFn: (row) => row.user?.email ?? '—',
      },
      {
        id: 'accountRoles',
        header: 'Vai trò tài khoản',
        accessorFn: (row) => row.user?.roles.map(({ role }) => role.name).join(', ') ?? '—',
      },
      {
        id: 'accountStatus',
        header: 'Trạng thái tài khoản',
        accessorFn: (row) => row.user ? row.user.isActive ? 'Đang hoạt động' : 'Đã khóa' : 'Chưa có tài khoản',
      },
      {
        id: 'lastLoginAt',
        header: 'Đăng nhập gần nhất',
        accessorFn: (row) => formatDateTime(row.user?.lastLoginAt),
      },
      ...(canReadPayroll ? [
        {
          accessorKey: 'taxCode',
          header: 'Mã số thuế',
        },
        {
          id: 'basicSalary',
          header: 'Lương cơ bản',
          accessorFn: (row: EmployeeListItem) => row.basicSalary ? formatCurrency(Number(row.basicSalary)) : '—',
          cell: ({ row }: { row: { original: EmployeeListItem } }) => <div className="text-right">{row.original.basicSalary ? formatCurrency(Number(row.original.basicSalary)) : '—'}</div>,
        },
        {
          id: 'spaBonusPercent',
          header: 'Thưởng Spa',
          accessorFn: (row: EmployeeListItem) => row.spaBonusPercent ? `${row.spaBonusPercent}%` : '—',
        },
        {
          accessorKey: 'salaryBankName',
          header: 'Ngân hàng',
        },
        {
          accessorKey: 'salaryBankAccount',
          header: 'Số tài khoản',
        },
      ] : []),
      ...(canEnrollFace ? [{
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }: { row: { original: EmployeeListItem } }) => (
          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" onClick={() => setFaceEmployee(row.original)} aria-label="Lấy dữ liệu khuôn mặt"><ScanFace /></Button>
          </div>
        ),
      }] : []),
    ],
    [canEnrollFace, canReadPayroll, isUpcomingExitFilter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân viên"
        description={`${isError ? 0 : data?.total ?? 0} nhân viên đã đăng ký`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EmployeeExcelActions canImport={hasPermission('employee:create') || canUpdate} />
            {canCreate && <Button asChild><Link href="/dashboard/karyawan/baru"><Plus />Thêm nhân viên</Link></Button>}
          </div>
        }
      />

      {isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Không thể tải danh sách nhân viên. Kiểm tra kết nối dữ liệu rồi thử tải lại.</div>}

      <DataTable
        tableId="employee-directory"
        columns={columns}
        data={filteredEmployees}
        initialColumnVisibility={EMPLOYEE_HIDDEN_COLUMNS}
        loading={isLoading && !isError}
        searchable={false}
        toolbarContent={(
          <>
            <div className="relative min-w-[260px] flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Tìm theo tên, mã nhân viên hoặc email..." aria-label="Tìm nhân viên" />
            </div>
            <Select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="w-auto"
            >
              <option value="">Tất cả phòng ban</option>
              {departments?.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              value={workStatus}
              onChange={(event) => setWorkStatus(event.target.value)}
              className="w-auto"
            >
              <option value="DEFAULT">Thử việc, chính thức, sắp nghỉ, tạm nghỉ</option>
              <option value="">Tất cả trạng thái</option>
              <option value="PROBATION,PERMANENT">Thử việc và Chính thức</option>
              <option value="PROBATION">Thử việc</option>
              <option value="PERMANENT">Chính thức</option>
              <option value="ON_LEAVE">Tạm nghỉ</option>
              <option value="INACTIVE">Thôi việc</option>
              <option value="ABANDONED">Bỏ việc</option>
              <option value="UPCOMING_EXIT">Sắp nghỉ</option>
            </Select>
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="w-auto">
              <option value="">Tất cả chi nhánh</option>
              {branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </>
        )}
        emptyTitle={isError ? 'Không tải được dữ liệu' : 'Chưa có nhân viên'}
        emptyDescription={isError ? 'Danh sách được ẩn do không thể kết nối với cơ sở dữ liệu.' : 'Thêm nhân viên đầu tiên để bắt đầu.'}
        onRowClick={(row) => router.push(`/dashboard/karyawan/${row.id}`)}
      />
      <Dialog open={!!faceEmployee} onOpenChange={(open) => { if (!open) setFaceEmployee(null); }}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Lấy dữ liệu khuôn mặt</DialogTitle>
          <DialogDescription>{faceEmployee ? `Nhân viên: ${faceEmployee.fullName} (${faceEmployee.employeeNo})` : ''}</DialogDescription>
          {faceEmployee && <EnrollScanner key={faceEmployee.id} employeeId={faceEmployee.id} onComplete={() => setFaceEmployee(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
