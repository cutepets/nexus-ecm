'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useDepartments, usePositions } from '@/features/employees/api';
import type { RoleAssignmentRule } from './api';

type RuleInput = Omit<RoleAssignmentRule, 'id' | 'role'>;
type RuleConditions = Pick<RuleInput, 'departmentId' | 'positionId'>;
const emptyConditions: RuleConditions = { departmentId: null, positionId: null };

export function RoleAssignmentRulesSettings({
  roleId,
  roleRules,
  onChange,
}: {
  roleId: string;
  roleRules: RuleInput[];
  onChange: (rules: RuleInput[]) => void;
}) {
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();
  const [conditions, setConditions] = useState<RuleConditions>(emptyConditions);

  const addRule = () => {
    if (!conditions.departmentId && !conditions.positionId) return;
    onChange([...roleRules, {
      ...conditions,
      name: roleId,
      roleId,
      isActive: true,
    }]);
    setConditions(emptyConditions);
  };

  const conditionLabel = (rule: RuleInput) => [
    rule.departmentId ? departments?.find((item) => item.id === rule.departmentId)?.name : null,
    rule.positionId ? positions?.find((item) => item.id === rule.positionId)?.title : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Điều kiện</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={conditions.departmentId ?? ''} onChange={(event) => setConditions((current) => ({ ...current, departmentId: event.target.value || null }))}>
          <option value="">Mọi phòng ban</option>
          {departments?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select value={conditions.positionId ?? ''} onChange={(event) => setConditions((current) => ({ ...current, positionId: event.target.value || null }))}>
          <option value="">Mọi chức vụ</option>
          {positions?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
        <Button type="button" variant="secondary" onClick={addRule}><Plus /> Thêm điều kiện</Button>
      </div>
      {roleRules.map((rule, index) => (
        <div key={`${rule.departmentId}-${rule.positionId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
          <span>{conditionLabel(rule)}</span>
          <Button type="button" size="icon" variant="ghost" aria-label="Xóa điều kiện" onClick={() => onChange(roleRules.filter((_, ruleIndex) => ruleIndex !== index))}><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}
