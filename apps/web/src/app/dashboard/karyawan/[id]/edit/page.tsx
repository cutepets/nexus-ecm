'use client';

import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '@/features/employees/employee-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployee, useUpdateEmployee } from '@/features/employees/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useEmployee(id);
  const update = useUpdateEmployee(id);
  const canUpdate = useAuthStore((state) => state.hasPermission('employee:update'));

  return (
    <div className="space-y-6">
      <PageHeader title="Chỉnh sửa nhân viên" />
      {!canUpdate ? (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="font-semibold">Bạn không có quyền chỉnh sửa hồ sơ</h2>
          <p className="mt-2 text-sm text-ink-muted">Chỉ quản lý được phân quyền mới có thể cập nhật thông tin nhân viên.</p>
          <Button className="mt-4" variant="secondary" onClick={() => router.push(`/dashboard/karyawan/${id}`)}>Quay lại hồ sơ</Button>
        </section>
      ) : isLoading ? (
        <Skeleton className="h-96 w-full rounded-card" />
      ) : isError || !data ? (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="font-semibold">Không tải được hồ sơ nhân viên</h2>
          <p className="mt-2 text-sm text-ink-muted">Kiểm tra kết nối API và migration cơ sở dữ liệu rồi thử lại.</p>
          <Button className="mt-4" onClick={() => void refetch()}>Thử lại</Button>
        </section>
      ) : (
        <EmployeeForm
          defaultValues={data}
          employeeId={id}
          submitting={update.isPending}
          onSubmit={(values) => update.mutateAsync(values)}
          onSaved={() => router.push(`/dashboard/karyawan/${id}`)}
        />
      )}
    </div>
  );
}
