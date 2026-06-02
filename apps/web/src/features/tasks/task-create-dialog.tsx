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
          <Plus /> Tugas Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Tugas Baru</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <Label>Judul</Label>
            <Input name="title" required placeholder="Apa yang harus dikerjakan?" />
          </div>
          {!projectId && (
            <div>
              <Label>Proyek</Label>
              <Select name="projectId">
                <option value="">— Tanpa proyek —</option>
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
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
                <option value="CRITICAL">Kritis</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue="TODO">
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="DONE">Done</option>
              </Select>
            </div>
            <div>
              <Label>Tenggat</Label>
              <Input name="dueDate" type="date" />
            </div>
            <div>
              <Label>Penanggung Jawab</Label>
              <Select name="assigneeId">
                <option value="">— Tidak ada —</option>
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
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Buat'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
