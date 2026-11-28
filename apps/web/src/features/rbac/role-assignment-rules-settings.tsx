'use client';

import { Select } from '@/components/ui/select';
import { useDepartments, usePositions } from '@/features/employees/api';

export type RoleAssignmentConditions = { departmentId: string | null; positionId: string | null };

export function RoleAssignmentRulesSettings({
  conditions,
  onConditionsChange,
}: {
  conditions: RoleAssignmentConditions;
  onConditionsChange: (conditions: RoleAssignmentConditions) => void;
}) {
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Điều kiện</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select name="departmentId" value={conditions.departmentId ?? ''} onChange={(event) => onConditionsChange({ ...conditions, departmentId: event.target.value || null })}>
          <option value="">Mọi phòng ban</option>
          {departments?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select name="positionId" value={conditions.positionId ?? ''} onChange={(event) => onConditionsChange({ ...conditions, positionId: event.target.value || null })}>
          <option value="">Mọi chức vụ</option>
          {positions?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
      </div>
      <p className="text-xs text-ink-muted">Chọn phòng ban, chức vụ hoặc cả hai rồi bấm Lưu. Nhân viên khớp điều kiện sẽ được gán vai trò.</p>
    </div>
  );
}
