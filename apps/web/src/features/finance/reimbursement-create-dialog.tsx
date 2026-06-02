'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmployeeSelect } from '@/features/attendance/employee-select';
import { useCreateReimbursement } from './api';

export function ReimbursementCreateDialog() {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const create = useCreateReimbursement();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!employeeId) return;
    create.mutate(
      { employeeId, title: String(fd.get('title')), amount: String(fd.get('amount')) },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Reimbursement
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Ajukan Reimbursement</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <EmployeeSelect value={employeeId} onChange={setEmployeeId} />
          <div>
            <Label>Judul</Label>
            <Input name="title" required placeholder="Transport meeting klien" />
          </div>
          <div>
            <Label>Nominal (IDR)</Label>
            <Input name="amount" type="number" min="0" required placeholder="300000" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Ajukan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
