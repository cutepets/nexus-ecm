'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useDepartments, usePositions } from '@/features/employees/api';
import { useBranches } from '@/features/settings/api';
import { useReplaceRoleAssignmentRules, useRoleAssignmentRules, useRoles, type RoleAssignmentRule } from './api';

type RuleInput = Omit<RoleAssignmentRule, 'id' | 'role'>;
const emptyRule: RuleInput = { name: '', roleId: '', departmentId: null, positionId: null, branchId: null, isActive: true };

export function RoleAssignmentRulesSettings() {
  const { data: currentRules } = useRoleAssignmentRules();
  const { data: roles } = useRoles();
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();
  const { data: branches } = useBranches();
  const save = useReplaceRoleAssignmentRules();
  const [rules, setRules] = useState<RuleInput[]>([]);
  const [form, setForm] = useState<RuleInput>(emptyRule);
  const availableRoles = (roles ?? []).filter((role) => role.name !== 'ADMIN');

  useEffect(() => {
    setRules((currentRules ?? []).map(({ name, roleId, departmentId, positionId, branchId, isActive }) => ({ name, roleId, departmentId, positionId, branchId, isActive })));
  }, [currentRules]);
  useEffect(() => {
    if (!form.roleId && availableRoles[0]) setForm((current) => ({ ...current, roleId: availableRoles[0].id }));
  }, [availableRoles, form.roleId]);

  const addRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.departmentId && !form.positionId && !form.branchId) {
      toast.error('Chọn ít nhất một điều kiện phòng ban, chức vụ hoặc chi nhánh');
      return;
    }
    if (!form.roleId || !form.name.trim()) return;
    setRules((items) => [...items, { ...form, name: form.name.trim(), isActive: true }]);
    setForm({ ...emptyRule, roleId: availableRoles[0]?.id ?? '' });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="font-semibold">Tự gán vai trò theo cơ cấu nhân sự</h3>
        <p className="mt-1 text-sm text-ink-muted">Mỗi điều kiện được kết hợp theo AND. Nhân viên khớp tất cả điều kiện sẽ nhận vai trò đó; vai trò gán thủ công được giữ nguyên.</p>
      </div>
      <form className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={addRule}>
        <Input placeholder="Tên điều kiện" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <Select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })} required>
          <option value="">Chọn vai trò</option>
          {availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </Select>
        <Select value={form.departmentId ?? ''} onChange={(event) => setForm({ ...form, departmentId: event.target.value || null })}>
          <option value="">Mọi phòng ban</option>
          {departments?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select value={form.positionId ?? ''} onChange={(event) => setForm({ ...form, positionId: event.target.value || null })}>
          <option value="">Mọi chức vụ</option>
          {positions?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
        <Select value={form.branchId ?? ''} onChange={(event) => setForm({ ...form, branchId: event.target.value || null })}>
          <option value="">Mọi chi nhánh</option>
          {branches?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary"><Plus /> Thêm điều kiện</Button>
      </form>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={`${rule.roleId}-${rule.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <div className="min-w-0"><p className="font-medium">{rule.name} → {roles?.find((item) => item.id === rule.roleId)?.name ?? 'Vai trò'}</p><p className="text-xs text-ink-muted">{[
              rule.departmentId ? departments?.find((item) => item.id === rule.departmentId)?.name : null,
              rule.positionId ? positions?.find((item) => item.id === rule.positionId)?.title : null,
              rule.branchId ? branches?.find((item) => item.id === rule.branchId)?.name : null,
            ].filter(Boolean).join(' · ')}</p></div>
            <Button type="button" size="icon" variant="ghost" aria-label={`Xóa điều kiện ${rule.name}`} onClick={() => setRules((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button>
          </div>
        ))}
        {!rules.length && <p className="text-sm text-ink-muted">Chưa có điều kiện tự gán vai trò.</p>}
      </div>
      <div className="flex justify-end"><Button disabled={save.isPending} onClick={() => save.mutate(rules)}>{save.isPending ? 'Đang lưu…' : 'Lưu điều kiện'}</Button></div>
    </section>
  );
}
