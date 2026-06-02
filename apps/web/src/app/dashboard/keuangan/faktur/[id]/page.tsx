'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useInvoice, useAddPayment } from '@/features/finance/api';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useInvoice(id);
  const addPayment = useAddPayment(id);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');

  if (isLoading || !data) return <Skeleton className="h-96 w-full rounded-card" />;

  const remaining = Number(data.total) - Number(data.paid);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.number}
        description={data.customer.name}
        action={<StatusBadge status={data.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-subtle">
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Harga</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{it.description}</td>
                    <td className="px-4 py-3 text-right">{Number(it.quantity)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(it.unitPrice))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(it.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-border p-4 text-right text-sm">
              <div>Subtotal: {formatCurrency(Number(data.subtotal))}</div>
              <div>Pajak: {formatCurrency(Number(data.tax))}</div>
              <div className="text-lg font-medium">Total: {formatCurrency(Number(data.total))}</div>
            </div>
          </div>

          <div className="rounded-card border border-border bg-card p-6 shadow-card">
            <h3 className="mb-3 text-base font-medium">Pembayaran</h3>
            {data.payments.length ? (
              <ul className="mb-4 divide-y divide-border">
                {data.payments.map((p) => (
                  <li key={p.id} className="flex justify-between py-2 text-sm">
                    <span>{formatDate(p.paidAt)}{p.method ? ` · ${p.method}` : ''}</span>
                    <span className="font-medium">{formatCurrency(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-ink-subtle">Belum ada pembayaran.</p>
            )}
            {remaining > 0 && (
              <div className="flex items-end gap-2">
                <div>
                  <Label>Nominal</Label>
                  <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(remaining)} />
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
                <Button
                  disabled={!amount || !paidAt || addPayment.isPending}
                  onClick={() => addPayment.mutate({ amount, paidAt }, { onSuccess: () => { setAmount(''); setPaidAt(''); } })}
                >
                  Catat
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-card border border-border bg-card p-6 shadow-card text-sm">
          <Row label="Terbit" value={formatDate(data.issueDate)} />
          <Row label="Jatuh Tempo" value={formatDate(data.dueDate)} />
          <Row label="Total" value={formatCurrency(Number(data.total))} />
          <Row label="Dibayar" value={formatCurrency(Number(data.paid))} />
          <Row label="Sisa" value={formatCurrency(remaining)} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
