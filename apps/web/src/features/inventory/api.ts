'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface Item {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorderLevel: number;
  unitCost: string;
  currentStock: number;
  lowStock: boolean;
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
}

export interface Warehouse { id: string; name: string; location?: string | null }
export interface StockMovement {
  id: string; type: string; quantity: number; createdAt: string;
  item: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string };
}

export function useItems(search?: string) {
  return useQuery({
    queryKey: ['items', search ?? ''],
    queryFn: async () => (await api.get<Item[]>('/inventory/items', { params: search ? { search } : undefined })).data,
  });
}
export function useWarehouses() {
  return useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get<Warehouse[]>('/inventory/warehouses')).data });
}
export function useMovements(itemId?: string) {
  return useQuery({
    queryKey: ['movements', itemId ?? 'all'],
    queryFn: async () => (await api.get<StockMovement[]>('/inventory/movements', { params: itemId ? { itemId } : undefined })).data,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/inventory/items', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); toast.success('Item dibuat'); },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat item')),
  });
}
export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/inventory/warehouses', p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); toast.success('Gudang dibuat'); },
  });
}
export function useAddMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>) => (await api.post('/inventory/movements', p)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      toast.success('Stok diperbarui');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal memperbarui stok')),
  });
}
export async function fetchItemQr(id: string) {
  return (await api.get<{ dataUrl: string; sku: string }>(`/inventory/items/${id}/qr`)).data;
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
