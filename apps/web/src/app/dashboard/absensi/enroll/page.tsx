'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { EnrollScanner } from '@/features/attendance/enroll-scanner';
import { useFaceStatus } from '@/features/attendance/api';
import { useAuthStore } from '@/stores/auth-store';

export default function EnrollPage() {
  const canEnroll = useAuthStore((s) => s.hasPermission('attendance:face:enroll'));
  const searchParams = useSearchParams();
  const [employeeId, setEmployeeId] = useState(() => searchParams.get('employeeId') ?? '');
  const { data: status } = useFaceStatus(employeeId);

  if (!canEnroll) {
    return (
      <div className="space-y-6">
        <PageHeader title="Đăng ký khuôn mặt" />
        <EmptyState
          icon={ShieldAlert}
          title="Bạn không có quyền thực hiện"
          description="Chỉ quản trị viên hoặc bộ phận nhân sự được đăng ký khuôn mặt. Hãy liên hệ bộ phận nhân sự để được hỗ trợ."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Đăng ký khuôn mặt" description="Ghi nhận nhiều mẫu khuôn mặt để chấm công chính xác" />
      <EmployeeSelect value={employeeId} onChange={setEmployeeId} />
      {employeeId && (
        <>
          {status?.enrolled && (
            <p className="text-center text-sm text-ink-muted">
              <Badge tone="mint">Đã đăng ký</Badge> {status.profiles} mẫu — đăng ký lại
              sẽ thay thế toàn bộ mẫu cũ.
            </p>
          )}
          <EnrollScanner employeeId={employeeId} />
        </>
      )}
    </div>
  );
}
