'use client';

import { useState, type FormEvent } from 'react';
import { Building2, BriefcaseBusiness, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { BranchSettings } from './branch-settings';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCreateDepartment, useCreatePosition, useDeleteDepartment, useDeletePosition,
  useDepartments, usePositions, useUpdateDepartment, useUpdatePosition,
} from '@/features/employees/api';
import type { Department, Position } from '@nexus/shared';

type StructureTab = 'branches' | 'departments' | 'positions';

export function EmployeeStructureSettings() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const allTabs: { id: StructureTab; label: string; icon: React.ReactNode; permission: string }[] = [
    { id: 'branches', label: 'Chi nhánh', icon: <MapPin size={16} />, permission: 'branch:read' },
    { id: 'departments', label: 'Phòng ban', icon: <Building2 size={16} />, permission: 'employee:read' },
    { id: 'positions', label: 'Chức vụ', icon: <BriefcaseBusiness size={16} />, permission: 'employee:read' },
  ];
  const tabs = allTabs.filter((tab) => hasPermission(tab.permission));
  const [tab, setTab] = useState<StructureTab>('departments');
  if (!tabs.length) return null;
  const selectedTab = tabs.some((item) => item.id === tab) ? tab : tabs[0].id;

  return <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
    <div className="mb-4"><h2 className="font-semibold text-ink">Cơ cấu nhân sự</h2><p className="mt-1 text-sm text-ink-muted">Quản lý phòng ban, chức vụ và chi nhánh dùng trong hồ sơ nhân viên.</p></div>
    <div className="mb-5 flex gap-2 overflow-x-auto border-b border-border pb-3" role="tablist">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={selectedTab === item.id} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${selectedTab === item.id ? 'bg-ink text-white' : 'bg-canvas text-ink-muted'}`}>{item.icon}{item.label}</button>)}
    </div>
    {selectedTab === 'branches' && <BranchSettings />}
    {selectedTab === 'departments' && <DepartmentPanel />}
    {selectedTab === 'positions' && <PositionPanel />}
  </section>;
}

function DepartmentPanel() {
  const { data: departments, isLoading } = useDepartments();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const canCreate = useAuthStore((state) => state.hasPermission('employee:create'));
  const canUpdate = useAuthStore((state) => state.hasPermission('employee:update'));
  const canDelete = useAuthStore((state) => state.hasPermission('employee:delete'));
  const [editing, setEditing] = useState<Department | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const startEdit = (department: Department) => { setEditing(department); setName(department.name); setCode(department.code); };
  const reset = () => { setEditing(null); setAddOpen(false); setName(''); setCode(''); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { name: name.trim(), code: code.trim().toUpperCase() };
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: reset });
    else create.mutate(payload, { onSuccess: reset });
  };

  return <div className="space-y-4">
    <div className="flex justify-end">{canCreate && <Button size="sm" onClick={() => { setName(''); setCode(''); setAddOpen(true); }}><Plus /> Thêm phòng ban</Button>}</div>
    <Dialog open={addOpen || !!editing} onOpenChange={(open) => { if (!open) reset(); }}><DialogContent className="p-5 sm:p-6"><DialogTitle>{editing ? 'Sửa phòng ban' : 'Thêm phòng ban'}</DialogTitle><form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
      <Input autoFocus required minLength={2} placeholder="Tên phòng ban" value={name} onChange={(event) => setName(event.target.value)} />
      <Input required placeholder="Mã phòng ban" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={reset}>Hủy</Button><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Đang lưu…' : 'Lưu'}</Button></div>
    </form></DialogContent></Dialog>
    {isLoading ? <p className="text-sm text-ink-muted">Đang tải phòng ban…</p> : departments?.length ? <div className="divide-y divide-border rounded-xl border border-border">
      {departments.map((department) => <div key={department.id} className="flex items-center justify-between gap-3 px-3 py-3">
        <div><p className="font-medium">{department.name} <span className="ml-1 text-xs font-normal text-ink-subtle">{department.code}</span></p><p className="mt-1 text-xs text-ink-muted">{department._count?.employees ?? 0} nhân viên · {department._count?.positions ?? 0} chức vụ</p></div>
        <div className="flex gap-1">{canUpdate && <Button size="icon" variant="ghost" aria-label="Sửa phòng ban" onClick={() => startEdit(department)}><Pencil /></Button>}{canDelete && <Button size="icon" variant="ghost" aria-label="Xóa phòng ban" onClick={() => setDeleting(department)}><Trash2 /></Button>}</div>
      </div>)}
    </div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-ink-muted">Chưa có phòng ban.</p>}
    <ConfirmDeleteDialog open={!!deleting} title="Xóa phòng ban" description={`Xóa phòng ban “${deleting?.name ?? ''}”? Chỉ xóa được phòng ban chưa có chức vụ hoặc nhân viên.`} pending={remove.isPending} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />
  </div>;
}

function PositionPanel() {
  const { data: departments } = useDepartments();
  const { data: positions, isLoading } = usePositions();
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const remove = useDeletePosition();
  const canCreate = useAuthStore((state) => state.hasPermission('employee:create'));
  const canUpdate = useAuthStore((state) => state.hasPermission('employee:update'));
  const canDelete = useAuthStore((state) => state.hasPermission('employee:delete'));
  const [editing, setEditing] = useState<Position | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Position | null>(null);
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [level, setLevel] = useState(1);

  const reset = () => { setEditing(null); setAddOpen(false); setTitle(''); setDepartmentId(''); setLevel(1); };
  const startEdit = (position: Position) => { setEditing(position); setTitle(position.title); setDepartmentId(position.departmentId); setLevel(position.level); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { title: title.trim(), departmentId, level: Math.max(1, level) };
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: reset });
    else create.mutate(payload, { onSuccess: reset });
  };

  return <div className="space-y-4">
    <div className="flex justify-end">{canCreate && <Button size="sm" onClick={() => { setTitle(''); setDepartmentId(''); setLevel(1); setAddOpen(true); }} disabled={!departments?.length}><Plus /> Thêm chức vụ</Button>}</div>
    <Dialog open={addOpen || !!editing} onOpenChange={(open) => { if (!open) reset(); }}><DialogContent className="p-5 sm:p-6"><DialogTitle>{editing ? 'Sửa chức vụ' : 'Thêm chức vụ'}</DialogTitle><form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
      <Input autoFocus required minLength={2} placeholder="Tên chức vụ" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Select required value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Chọn phòng ban</option>{departments?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select>
      <label className="space-y-1.5"><span className="text-sm font-medium text-ink">Cấp bậc</span><Input required type="number" min={1} value={level} onChange={(event) => setLevel(Number(event.target.value))} /></label>
      <div className="flex items-end justify-end gap-2"><Button type="button" variant="secondary" onClick={reset}>Hủy</Button><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Đang lưu…' : 'Lưu'}</Button></div>
    </form></DialogContent></Dialog>
    {isLoading ? <p className="text-sm text-ink-muted">Đang tải chức vụ…</p> : positions?.length ? <div className="divide-y divide-border rounded-xl border border-border">
      {positions.map((position) => <div key={position.id} className="flex items-center justify-between gap-3 px-3 py-3">
        <div><p className="font-medium">{position.title} <span className="ml-1 text-xs font-normal text-ink-subtle">Cấp {position.level}</span></p><p className="mt-1 text-xs text-ink-muted">{position.department?.name ?? departments?.find((department) => department.id === position.departmentId)?.name ?? 'Chưa có phòng ban'} · {position._count?.employees ?? 0} nhân viên</p></div>
        <div className="flex gap-1">{canUpdate && <Button size="icon" variant="ghost" aria-label="Sửa chức vụ" onClick={() => startEdit(position)}><Pencil /></Button>}{canDelete && <Button size="icon" variant="ghost" aria-label="Xóa chức vụ" onClick={() => setDeleting(position)}><Trash2 /></Button>}</div>
      </div>)}
    </div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-ink-muted">Chưa có chức vụ.</p>}
    <ConfirmDeleteDialog open={!!deleting} title="Xóa chức vụ" description={`Xóa chức vụ “${deleting?.title ?? ''}”? Chỉ xóa được chức vụ chưa được gán cho nhân viên.`} pending={remove.isPending} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />
  </div>;
}
