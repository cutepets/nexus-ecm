'use client';

import { useMemo, useState } from 'react';
import { Plus, QrCode, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import {
  useItems,
  useWarehouses,
  useCreateItem,
  useCreateWarehouse,
  useAddMovement,
  fetchItemQr,
  type Item,
} from '@/features/inventory/api';

export default function InventoryPage() {
  const { data: items, isLoading } = useItems();
  const [qr, setQr] = useState<{ url: string; sku: string } | null>(null);

  const showQr = async (id: string) => {
    const r = await fetchItemQr(id);
    setQr({ url: r.dataUrl, sku: r.sku });
  };

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      { accessorKey: 'name', header: 'Item', cell: ({ row }) => (
        <div><div className="font-medium">{row.original.name}</div><div className="text-xs text-ink-subtle">{row.original.sku}</div></div>
      ) },
      { id: 'cat', header: 'Kategori', cell: ({ row }) => row.original.category?.name ?? '—' },
      { id: 'stock', header: 'Stok', cell: ({ row }) => (
        <span className="flex items-center gap-2">
          {row.original.currentStock} {row.original.unit}
          {row.original.lowStock && <Badge tone="red"><AlertTriangle className="size-3" /> Rendah</Badge>}
        </span>
      ) },
      { id: 'cost', header: 'Harga', cell: ({ row }) => formatCurrency(Number(row.original.unitCost)) },
      { id: 'actions', header: '', cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => showQr(row.original.id)}><QrCode /> QR</Button>
      ) },
    ],
    [],
  );

  const lowCount = items?.filter((i) => i.lowStock).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${items?.length ?? 0} item${lowCount ? ` · ${lowCount} stok rendah` : ''}`}
        action={
          <div className="flex gap-2">
            <MovementDialog />
            <ItemDialog />
          </div>
        }
      />

      <DataTable columns={columns} data={items ?? []} loading={isLoading} searchPlaceholder="Cari item / SKU…" emptyTitle="Belum ada item" />

      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="p-6 text-center">
          <DialogTitle className="text-lg font-medium">QR Code · {qr?.sku}</DialogTitle>
          {qr && <img src={qr.url} alt="QR" className="mx-auto mt-4 size-48" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateItem();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate(
      { name: String(fd.get('name')), unit: String(fd.get('unit') || 'pcs'), reorderLevel: Number(fd.get('reorderLevel') || 0), unitCost: String(fd.get('unitCost') || '0') },
      { onSuccess: () => setOpen(false) },
    );
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Item</Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Item Baru</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div><Label>Nama</Label><Input name="name" required placeholder="Laptop Dell" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Satuan</Label><Input name="unit" defaultValue="pcs" /></div>
            <div><Label>Reorder</Label><Input name="reorderLevel" type="number" min="0" defaultValue="0" /></div>
            <div><Label>Harga</Label><Input name="unitCost" type="number" min="0" defaultValue="0" /></div>
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

function MovementDialog() {
  const [open, setOpen] = useState(false);
  const { data: items } = useItems();
  const { data: warehouses } = useWarehouses();
  const createWh = useCreateWarehouse();
  const move = useAddMovement();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    move.mutate(
      { itemId: String(fd.get('itemId')), warehouseId: String(fd.get('warehouseId')), type: String(fd.get('type')), quantity: Number(fd.get('quantity')) },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><ArrowLeftRight /> Pergerakan Stok</Button></DialogTrigger>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-medium">Pergerakan Stok</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div><Label>Item</Label>
            <Select name="itemId" required>
              <option value="">— Pilih —</option>
              {items?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.currentStock})</option>)}
            </Select>
          </div>
          <div><Label>Gudang</Label>
            {warehouses?.length ? (
              <Select name="warehouseId" required>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            ) : (
              <Button type="button" variant="secondary" onClick={() => createWh.mutate({ name: 'Gudang Utama' })}>+ Buat Gudang Utama</Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tipe</Label>
              <Select name="type" defaultValue="IN">
                <option value="IN">Masuk (IN)</option>
                <option value="OUT">Keluar (OUT)</option>
                <option value="ADJUST">Penyesuaian</option>
              </Select>
            </div>
            <div><Label>Jumlah</Label><Input name="quantity" type="number" required defaultValue="1" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={move.isPending}>Catat</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
