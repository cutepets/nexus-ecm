'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { useLeaveTypes, useCreateLeave, uploadLeaveDoc } from '@/features/leave/api';
import { useAuthStore } from '@/stores/auth-store';

export default function NewLeavePage() {
  const router = useRouter();
  const { data: types } = useLeaveTypes();
  const create = useCreateLeave();

  // Managers/HR may file on behalf of others; employees auto-file for themselves.
  const canManage = useAuthStore((s) => s.hasPermission('leave:approve'));
  const ownEmployeeId = useAuthStore((s) => s.user?.employeeId);
  const [picked, setPicked] = useState('');
  const employeeId = canManage ? picked : ownEmployeeId ?? '';
  const setEmployeeId = setPicked;
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [docKey, setDocKey] = useState<string | null>(null);

  const selectedType = types?.find((t) => t.id === leaveTypeId);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setDocKey(await uploadLeaveDoc(file));
      toast.success('Đã tải tài liệu lên');
    } catch {
      toast.error('Không thể tải tài liệu lên');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!employeeId || !leaveTypeId) {
      toast.error(canManage ? 'Vui lòng chọn nhân viên và loại nghỉ phép' : 'Vui lòng chọn loại nghỉ phép');
      return;
    }
    create.mutate(
      {
        employeeId,
        leaveTypeId,
        startDate: String(fd.get('startDate')),
        endDate: String(fd.get('endDate')),
        reason: String(fd.get('reason')),
        documentUrl: docKey ?? undefined,
      },
      { onSuccess: (r) => router.push(`/dashboard/cuti/${r.id}`) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tạo đơn nghỉ phép" description="Điền thông tin đơn nghỉ phép hoặc nghỉ có lý do" />
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canManage && (
              <div className="sm:col-span-2">
                <EmployeeSelect value={picked} onChange={setEmployeeId} />
              </div>
            )}
            <div>
              <Label>Loại nghỉ phép</Label>
              <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
                <option value="">— Chọn loại nghỉ —</option>
                {types?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.defaultQuota > 0 ? ` (còn ${t.defaultQuota} ngày)` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div />
            <div>
              <Label>Ngày bắt đầu</Label>
              <Input name="startDate" type="date" required />
            </div>
            <div>
              <Label>Ngày kết thúc</Label>
              <Input name="endDate" type="date" required />
            </div>
            <div className="sm:col-span-2">
              <Label>Lý do</Label>
              <Textarea name="reason" required placeholder="Nêu lý do nghỉ phép" />
            </div>
            {selectedType?.requiresDoc && (
              <div className="sm:col-span-2">
                <Label>Tài liệu đính kèm (bắt buộc)</Label>
                <Button asChild variant="secondary" disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload /> {uploading ? 'Đang tải lên…' : docKey ? 'Đổi tệp' : 'Tải tệp lên'}
                    <input type="file" className="hidden" onChange={onFile} />
                  </label>
                </Button>
                {docKey && <span className="ml-3 text-xs text-emerald-600">Đã tải lên ✓</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Hủy
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Đang gửi…' : 'Gửi đơn'}
          </Button>
        </div>
      </form>
    </div>
  );
}
