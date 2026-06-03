'use client';

import { useState } from 'react';
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
  const [employeeId, setEmployeeId] = useState('');
  const { data: status } = useFaceStatus(employeeId);

  if (!canEnroll) {
    return (
      <div className="space-y-6">
        <PageHeader title="Daftar Wajah" />
        <EmptyState
          icon={ShieldAlert}
          title="Tidak diizinkan"
          description="Pendaftaran wajah hanya dapat dilakukan oleh HR/Admin. Hubungi HR untuk mendaftarkan wajah Anda."
        />
      </div>
    );
  }

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
