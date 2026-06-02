'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useProjects, useCreateProject } from '@/features/projects/api';

export default function ProyekPage() {
  const router = useRouter();
  const { data, isLoading } = useProjects();

  return (
    <div className="space-y-6">
      <PageHeader title="Proyek" description="Kelola proyek, milestone, dan progres" action={<CreateDialog />} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard/proyek/${p.id}`)}
              className="rounded-card border border-border bg-card p-5 text-left shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-ink-subtle">{p.code}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-ink-muted">
                  <span>Progres</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-accent-purple" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
              <div className="mt-4 flex justify-between text-xs text-ink-muted">
                <span>{p._count.tasks} tugas · {p._count.members} anggota</span>
                {p.deadline && <span>{formatDate(p.deadline)}</span>}
              </div>
              <div className="mt-1 text-xs text-ink-subtle">
                Anggaran: {formatCurrency(Number(p.budgetPlanned))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Belum ada proyek" description="Buat proyek pertama Anda." />
      )}
    </div>
  );
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateProject();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate(
      {
        name: String(fd.get('name')),
        code: String(fd.get('code')),
        status: String(fd.get('status')),
        deadline: String(fd.get('deadline') || '') || undefined,
        budgetPlanned: String(fd.get('budgetPlanned') || '') || undefined,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Proyek Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Proyek Baru</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nama</Label>
              <Input name="name" required placeholder="Website Revamp" />
            </div>
            <div>
              <Label>Kode</Label>
              <Input name="code" required placeholder="WEB-2026" />
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue="PLANNING">
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            <div>
              <Label>Tenggat</Label>
              <Input name="deadline" type="date" />
            </div>
            <div>
              <Label>Anggaran (IDR)</Label>
              <Input name="budgetPlanned" type="number" min="0" placeholder="50000000" />
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
