'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { CheckScanner } from '@/features/attendance/check-scanner';

export default function CheckOutPage() {
  const [employeeId, setEmployeeId] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader title="Check-out" description="Akhiri kehadiran hari ini" />
      <EmployeeSelect value={employeeId} onChange={setEmployeeId} />
      {employeeId && <CheckScanner kind="check-out" employeeId={employeeId} />}
    </div>
  );
}
