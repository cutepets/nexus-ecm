'use client';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useEmployees } from '@/features/employees/api';

/**
 * Picks which employee the kiosk acts for. In a self-service deployment this
 * would be derived from the logged-in user; for admin/kiosk use it's explicit.
 */
export function EmployeeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data } = useEmployees({ pageSize: 100, workStatus: undefined });

  return (
    <div className="mx-auto max-w-md">
      <Label>Karyawan</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Pilih karyawan —</option>
        {data?.items.map((e) => (
          <option key={e.id} value={e.id}>
            {e.fullName} · {e.employeeNo}
          </option>
        ))}
      </Select>
    </div>
  );
}
