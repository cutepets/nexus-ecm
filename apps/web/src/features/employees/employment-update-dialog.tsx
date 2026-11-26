'use client';

import { useState } from 'react';
import { CalendarDays, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useBranches, useWorkSchedules } from '@/features/settings/api';
import { uploadEmploymentHistoryDocuments, useDepartments, usePositions, useTerminateEmployee, useUpdateEmployee } from './api';
import { useAuthStore } from '@/stores/auth-store';

type ChangeType = 'SALARY' | 'PROMOTION' | 'SCHEDULE' | 'EMPLOYMENT_TYPE' | 'WORK_STATUS' | 'TERMINATION';

const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const choices: { value: ChangeType; label: string }[] = [
  { value: 'SALARY', label: 'Tăng lương / thưởng' },
  { value: 'PROMOTION', label: 'Bổ nhiệm / điều chỉnh chức vụ, chi nhánh' },
  { value: 'SCHEDULE', label: 'Đổi ca làm mặc định' },
  { value: 'EMPLOYMENT_TYPE', label: 'Đổi loại hình làm việc' },
  { value: 'WORK_STATUS', label: 'Tạm nghỉ / quay lại làm việc' },
  { value: 'TERMINATION', label: 'Cho thôi việc' },
];

export function EmploymentUpdateDialog({ employeeId, currentStatus, onOpen, onClose, onSaved }: {
  employeeId: string; currentStatus: string; onOpen: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [changeType, setChangeType] = useState<ChangeType>(() => useAuthStore.getState().hasPermission('payroll:update') ? 'SALARY' : 'PROMOTION');
  const [departmentId, setDepartmentId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const canManagePayroll = useAuthStore((state) => state.hasPermission('payroll:update'));
  const update = useUpdateEmployee(employeeId);
  const terminate = useTerminateEmployee();
  const { data: branches } = useBranches();
  const { data: schedules } = useWorkSchedules();
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions(departmentId || undefined);
  const busy = update.isPending || terminate.isPending;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const effectiveDate = String(fd.get('effectiveDate') || '');
    const details = String(fd.get('details') || '').trim();
    const decisionNumber = String(fd.get('decisionNumber') || '').trim();
    if (!effectiveDate) {
      toast.error('Nhập ngày hiệu lực.');
      return;
    }
    if (changeType === 'SALARY' && !canManagePayroll) {
      toast.error('Bạn không có quyền cập nhật lương, thưởng.');
      return;
    }

    try {
      const historyDocuments = files.length ? await uploadEmploymentHistoryDocuments(employeeId, files) : [];
      const metadata = { effectiveDate, changeReason: details || (changeType === 'TERMINATION' ? 'Cho thôi việc' : 'Cập nhật thông tin nhân sự'), decisionNumber, historyDocuments };
      if (changeType === 'TERMINATION') {
        terminate.mutate({ id: employeeId, terminationDate: effectiveDate, terminationReason: metadata.changeReason, decisionNumber, historyDocuments }, {
          onSuccess: () => { onClose(); onSaved(); },
        });
        return;
      }

      const payload: Record<string, unknown> = { ...metadata };
      if (changeType === 'SALARY') {
        const amount = String(fd.get('basicSalary') || '');
        const bonus = String(fd.get('spaBonusPercent') || '');
        if (amount) payload.basicSalary = Number(amount);
        if (bonus) payload.spaBonusPercent = Number(bonus);
        if (!amount && !bonus) { toast.error('Nhập mức lương hoặc phần trăm thưởng cần thay đổi.'); return; }
      } else if (changeType === 'PROMOTION') {
        const newDepartmentId = String(fd.get('departmentId') || '');
        const newPositionId = String(fd.get('positionId') || '');
        const branchId = String(fd.get('primaryBranchId') || '');
        if (newDepartmentId) payload.departmentId = newDepartmentId;
        if (newPositionId) payload.positionId = newPositionId;
        if (branchId) {
          payload.primaryBranchId = branchId;
          payload.branchIds = [branchId];
        }
        if (!newDepartmentId && !newPositionId && !branchId) { toast.error('Chọn chức vụ, phòng ban hoặc chi nhánh cần cập nhật.'); return; }
      } else if (changeType === 'SCHEDULE') {
        const workScheduleId = String(fd.get('workScheduleId') || '');
        if (!workScheduleId) { toast.error('Chọn ca làm mặc định mới.'); return; }
        payload.workScheduleId = workScheduleId;
      } else if (changeType === 'EMPLOYMENT_TYPE') {
        payload.employmentType = String(fd.get('employmentType'));
      } else if (changeType === 'WORK_STATUS') {
        payload.workStatus = String(fd.get('workStatus'));
      }

      update.mutate(payload, { onSuccess: () => { onClose(); onSaved(); } });
    } catch {
      toast.error('Không tải được tài liệu đính kèm. Vui lòng thử lại.');
    }
  };

  return <Dialog open={onOpen} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto p-6">
      <DialogTitle>Cập nhật quá trình làm việc</DialogTitle>
      <DialogDescription>Ghi nhận thay đổi dài hạn vào hồ sơ nhân viên. Điều chỉnh lịch tạm thời thực hiện trong mục Lịch.</DialogDescription>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Loại cập nhật</Label><Select value={changeType} onChange={(event) => setChangeType(event.target.value as ChangeType)}>
            {choices.filter((choice) => choice.value !== 'SALARY' || canManagePayroll).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </Select></div>
          <div><Label className="flex items-center gap-2"><CalendarDays size={15} />Ngày hiệu lực</Label><Input name="effectiveDate" type="date" defaultValue={vietnamToday()} required /></div>
          {changeType === 'SALARY' && <>
            <div><Label>Lương cơ bản mới (₫)</Label><Input name="basicSalary" type="number" min="0" step="any" placeholder="Để trống nếu không đổi" /></div>
            <div><Label>Thưởng Spa mới (%)</Label><Input name="spaBonusPercent" type="number" min="0" max="100" step="any" placeholder="Để trống nếu không đổi" /></div>
          </>}
          {changeType === 'PROMOTION' && <>
            <div><Label>Phòng ban mới</Label><Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Giữ nguyên</option>{departments?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
            <div><Label>Chức vụ mới</Label><Select name="positionId"><option value="">Giữ nguyên</option>{positions?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select><input type="hidden" name="departmentId" value={departmentId} /></div>
            <div className="sm:col-span-2"><Label>Chi nhánh chính mới</Label><Select name="primaryBranchId" defaultValue=""><option value="">Giữ nguyên</option>{branches?.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
          </>}
          {changeType === 'SCHEDULE' && <div className="sm:col-span-2"><Label>Ca làm mặc định mới</Label><Select name="workScheduleId" defaultValue=""><option value="">Chọn ca</option>{schedules?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.startTime}–{item.endTime}</option>)}</Select></div>}
          {changeType === 'EMPLOYMENT_TYPE' && <div className="sm:col-span-2"><Label>Loại hình mới</Label><Select name="employmentType"><option value="FULL_TIME">Toàn thời gian</option><option value="PART_TIME">Bán thời gian</option></Select></div>}
          {changeType === 'WORK_STATUS' && <div className="sm:col-span-2"><Label>Trạng thái làm việc</Label><Select name="workStatus" defaultValue={currentStatus === 'ON_LEAVE' ? 'PERMANENT' : currentStatus}><option value="PROBATION">Thử việc</option><option value="PERMANENT">Chính thức</option><option value="CONTRACT">Hợp đồng</option><option value="ON_LEAVE">Tạm nghỉ</option></Select></div>}
          {changeType === 'TERMINATION' && <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">Tài khoản nhân viên sẽ bị khóa và các phiên đăng nhập sẽ bị thu hồi kể từ ngày hiệu lực.</p>}
          <div className="sm:col-span-2"><Label>Nội dung bổ sung</Label><Textarea name="details" rows={3} placeholder="Ghi thêm nội dung, căn cứ hoặc phạm vi thay đổi" /></div>
          <div><Label>Số quyết định</Label><Input name="decisionNumber" placeholder="Không bắt buộc" /></div>
          <div><Label className="flex items-center gap-2"><Upload size={15} />Tài liệu liên quan</Label><Input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><DialogClose asChild><Button type="button" variant="secondary" disabled={busy}>Hủy</Button></DialogClose><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : changeType === 'TERMINATION' ? 'Xác nhận' : 'Lưu'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
