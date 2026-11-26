'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useEmployees } from '@/features/employees/api';
import { useProjects } from '@/features/projects/api';
import { useCreateTask } from './api';

/** Quick task creator. When `projectId` is fixed (project board) the project picker is hidden. */
export function TaskCreateDialog({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreateTask();
  const { data: employees } = useEmployees({ pageSize: 100 });
  const { data: projects } = useProjects();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const assignee = String(fd.get('assigneeId') || '');
    create.mutate(
      {
        title: String(fd.get('title')),
        projectId: projectId ?? (String(fd.get('projectId') || '') || undefined),
        priority: String(fd.get('priority')),
        status: String(fd.get('status')),
        dueDate: String(fd.get('dueDate') || '') || undefined,
        assigneeIds: assignee ? [assignee] : undefined,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Tạo công việc
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Tạo công việc</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <Label>Tiêu đề</Label>
            <Input name="title" required placeholder="Công việc cần thực hiện là gì?" />
          </div>
          {!projectId && (
            <div>
              <Label>Dự án</Label>
              <Select name="projectId">
                <option value="">— Không thuộc dự án —</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioritas</Label>
              <Select name="priority" defaultValue="MEDIUM">
                <option value="LOW">Thấp</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HIGH">Cao</option>
                <option value="CRITICAL">Khẩn cấp</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue="TODO">
                <option value="TODO">Cần thực hiện</option>
                <option value="IN_PROGRESS">Đang thực hiện</option>
                <option value="REVIEW">Chờ duyệt</option>
                <option value="DONE">Hoàn thành</option>
              </Select>
            </div>
            <div>
              <Label>Tenggat</Label>
              <Input name="dueDate" type="date" />
            </div>
            <div>
              <Label>Người phụ trách</Label>
              <Select name="assigneeId">
                <option value="">— Chưa phân công —</option>
                {employees?.items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Đang lưu…' : 'Tạo công việc'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
