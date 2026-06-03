'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { CheckScanner } from '@/features/attendance/check-scanner';
import { useAuthStore } from '@/stores/auth-store';

export default function CheckInPage() {
  const canManage = useAuthStore((s) => s.hasPermission('attendance:update'));
  const ownEmployeeId = useAuthStore((s) => s.user?.employeeId);
  const [picked, setPicked] = useState('');

  // Employees check in for themselves; privileged users (kiosk/HR) pick a person.
  const employeeId = canManage ? picked : ownEmployeeId ?? '';

  return (
    <div className="space-y-6">
      <PageHeader title="Check-in" description="Verifikasi wajah, liveness, dan lokasi" />
      {canManage && <EmployeeSelect value={picked} onChange={setPicked} />}
      {employeeId ? (
        <CheckScanner kind="check-in" employeeId={employeeId} />
      ) : (
        !canManage && <p className="text-center text-sm text-ink-subtle">Akun Anda tidak tertaut ke data karyawan.</p>
      )}
    </div>
  );
}
