'use client';

import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '@/features/employees/employee-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployee, useUpdateEmployee } from '@/features/employees/api';

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useEmployee(id);
  const update = useUpdateEmployee(id);

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Karyawan" description={data?.fullName} />
      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-card" />
      ) : (
        <EmployeeForm
          defaultValues={data}
          submitting={update.isPending}
          onSubmit={(values) =>
            update.mutate(values, { onSuccess: () => router.push(`/dashboard/karyawan/${id}`) })
          }
        />
      )}
    </div>
  );
}
