'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { useCustomers, useCreateCustomer, useCreateInvoice } from './api';

interface Line {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function InvoiceCreateDialog() {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [taxRate, setTaxRate] = useState(11);
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: customers } = useCustomers();
  const createCustomer = useCreateCustomer();
  const create = useCreateInvoice();

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = subtotal + (subtotal * taxRate) / 100;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = () => {
    if (!customerId || !issueDate || !dueDate || lines.some((l) => !l.description)) return;
    create.mutate(
      { customerId, issueDate, dueDate, taxRate, items: lines },
      { onSuccess: () => setOpen(false) },
    );
  };

  const quickCustomer = () => {
    const name = prompt('Nama pelanggan baru:');
    if (name) createCustomer.mutate({ name }, { onSuccess: (c) => setCustomerId(c.id) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Faktur Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-6">
        <DialogTitle className="text-lg font-medium">Faktur Baru</DialogTitle>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Pelanggan</Label>
              <div className="flex gap-2">
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="secondary" onClick={quickCustomer}>
                  + Baru
                </Button>
              </div>
            </div>
            <div>
              <Label>Tanggal Terbit</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Jatuh Tempo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Item</Label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Deskripsi"
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Harga"
                    value={l.unitPrice}
                    onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setLines((ls) => [...ls, { description: '', quantity: 1, unitPrice: 0 }])}
            >
              <Plus /> Tambah item
            </Button>
          </div>

          <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
            <div className="w-28">
              <Label>Pajak (%)</Label>
              <Input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
            </div>
            <div className="text-right text-sm">
              <div className="text-ink-muted">Subtotal: {formatCurrency(subtotal)}</div>
              <div className="text-lg font-medium">Total: {formatCurrency(total)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Buat Faktur'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
