'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { EnrollScanner } from '@/features/attendance/enroll-scanner';
import { useFaceStatus } from '@/features/attendance/api';

export default function EnrollPage() {
  const [employeeId, setEmployeeId] = useState('');
  const { data: status } = useFaceStatus(employeeId);

  return (
    <div className="space-y-6">
      <PageHeader title="Daftar Wajah" description="Rekam beberapa sampel wajah untuk absensi" />
      <EmployeeSelect value={employeeId} onChange={setEmployeeId} />
      {employeeId && (
        <>
          {status?.enrolled && (
            <p className="text-center text-sm text-ink-muted">
              <Badge tone="mint">Sudah terdaftar</Badge> {status.profiles} sampel — merekam ulang
              akan menambah sampel.
            </p>
          )}
          <EnrollScanner employeeId={employeeId} />
        </>
      )}
    </div>
  );
}
