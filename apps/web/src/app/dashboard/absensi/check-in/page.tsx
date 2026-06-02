'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { CheckScanner } from '@/features/attendance/check-scanner';

export default function CheckInPage() {
  const [employeeId, setEmployeeId] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader title="Check-in" description="Verifikasi wajah, liveness, dan lokasi" />
      <EmployeeSelect value={employeeId} onChange={setEmployeeId} />
      {employeeId && <CheckScanner kind="check-in" employeeId={employeeId} />}
    </div>
  );
}
