'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useExpenseCategories, useCreateExpense } from './api';

export function ExpenseCreateDialog() {
  const [open, setOpen] = useState(false);
  const { data: categories } = useExpenseCategories();
  const create = useCreateExpense();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate(
      {
        categoryId: String(fd.get('categoryId')),
        title: String(fd.get('title')),
        amount: String(fd.get('amount')),
        spentAt: String(fd.get('spentAt')),
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Pengeluaran
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Catat Pengeluaran</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <Label>Judul</Label>
            <Input name="title" required placeholder="Internet kantor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategori</Label>
              <Select name="categoryId" required>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input name="spentAt" type="date" required />
            </div>
            <div className="col-span-2">
              <Label>Nominal (IDR)</Label>
              <Input name="amount" type="number" min="0" required placeholder="1500000" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
