'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import {
  useBoard,
  useLeads,
  useStages,
  useCreateLead,
  useSetLeadStatus,
  useCreateOpportunity,
  useMoveOpportunity,
  type Lead,
} from '@/features/crm/api';
import { useCustomers } from '@/features/finance/api';

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="CRM" description="Pipeline penjualan, leads, dan pelanggan" />
      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="customers">Pelanggan</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline"><Pipeline /></TabsContent>
        <TabsContent value="leads"><Leads /></TabsContent>
        <TabsContent value="customers"><Customers /></TabsContent>
      </Tabs>
    </div>
  );
}

function Pipeline() {
  const { data: board } = useBoard();
  const move = useMoveOpportunity();
  const stages = board?.map((b) => b.stage) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><OpportunityDialog /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {board?.map((col) => (
          <div key={col.stage.id} className="rounded-card border border-border bg-canvas/60 p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-medium">{col.stage.name}</span>
              <span className="text-xs text-ink-subtle">{col.count}</span>
            </div>
            <div className="mb-2 px-1 text-xs text-ink-muted">{formatCurrency(col.value)}</div>
            <div className="space-y-2">
              {col.opportunities.map((o) => (
                <div key={o.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
                  <div className="text-sm font-medium">{o.title}</div>
                  <div className="text-xs text-ink-subtle">{o.customer?.name ?? '—'}</div>
                  <div className="mt-1 text-xs font-medium">{formatCurrency(Number(o.value))}</div>
                  <Select
                    className="mt-2 h-7 text-xs"
                    value={o.stageId}
                    onChange={(e) => move.mutate({ id: o.id, stageId: e.target.value })}
                  >
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunityDialog() {
  const [open, setOpen] = useState(false);
  const { data: stages } = useStages();
  const { data: customers } = useCustomers();
  const create = useCreateOpportunity();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate(
      { title: String(fd.get('title')), stageId: String(fd.get('stageId')), value: String(fd.get('value') || '0'), customerId: String(fd.get('customerId') || '') || undefined },
      { onSuccess: () => setOpen(false) },
    );
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Peluang</Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Peluang Baru</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div><Label>Judul</Label><Input name="title" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tahap</Label><Select name="stageId" required>{stages?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <div><Label>Nilai</Label><Input name="value" type="number" min="0" defaultValue="0" /></div>
          </div>
          <div><Label>Pelanggan</Label><Select name="customerId"><option value="">—</option>{customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={create.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Leads() {
  const { data: leads, isLoading } = useLeads();
  const setStatus = useSetLeadStatus();
  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: 'source', header: 'Sumber', cell: ({ row }) => row.original.source ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'actions', header: '', cell: ({ row }) => (
      <Select className="h-7 w-32 text-xs" value={row.original.status} onChange={(e) => setStatus.mutate({ id: row.original.id, status: e.target.value })}>
        {['NEW', 'CONTACTED', 'QUALIFIED', 'LOST'].map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
    ) },
  ], [setStatus]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><LeadDialog /></div>
      <DataTable columns={columns} data={leads ?? []} loading={isLoading} emptyTitle="Belum ada lead" />
    </div>
  );
}

function LeadDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateLead();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({ name: String(fd.get('name')), source: String(fd.get('source') || '') || undefined, email: String(fd.get('email') || '') || undefined }, { onSuccess: () => setOpen(false) });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Lead</Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Lead Baru</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div><Label>Nama</Label><Input name="name" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Sumber</Label><Input name="source" placeholder="Web / Referral" /></div>
            <div><Label>Email</Label><Input name="email" type="email" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={create.isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Customers() {
  const { data: customers, isLoading } = useCustomers();
  if (isLoading) return null;
  if (!customers?.length) return <EmptyState title="Belum ada pelanggan" description="Pelanggan dibuat dari modul Keuangan saat membuat faktur." />;
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      {customers.map((c) => (
        <div key={c.id} className="flex justify-between border-b border-border px-4 py-3 last:border-0">
          <span className="font-medium">{c.name}</span>
          <span className="text-sm text-ink-subtle">{c.company ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
