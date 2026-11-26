'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '@/features/employees/employee-form';
import { useCreateEmployee } from '@/features/employees/api';

export default function NewEmployeePage() {
  const router = useRouter();
  const create = useCreateEmployee();

  return (
    <div className="space-y-6">
      <PageHeader title="Thêm nhân viên" />
      <EmployeeForm
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (emp) => router.push(`/dashboard/karyawan/${emp.id}`),
          })
        }
      />
    </div>
  );
}
