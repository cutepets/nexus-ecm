'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface Customer {
  id: string;
  name: string;
  company?: string | null;
}

export interface InvoiceListItem {
  id: string;
  number: string;
  total: string;
  paid: string;
  status: string;
  issueDate: string;
  dueDate: string;
  customer: { id: string; name: string };
}

export interface InvoiceDetail extends InvoiceListItem {
  subtotal: string;
  tax: string;
  items: { id: string; description: string; quantity: string; unitPrice: string; lineTotal: string }[];
  payments: { id: string; amount: string; paidAt: string; method?: string | null }[];
}

export interface Expense {
  id: string;
  title: string;
  amount: string;
  spentAt: string;
  status: string;
  category: { id: string; name: string };
}

export interface Reimbursement {
  id: string;
  title: string;
  amount: string;
  status: string;
  employee: { id: string; fullName: string };
}

export interface FinanceSummary {
  income: number;
  expense: number;
  net: number;
  outstanding: number;
}

// ---- Customers ----
export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', search ?? ''],
    queryFn: async () => (await api.get<Customer[]>('/customers', { params: search ? { search } : undefined })).data,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post<Customer>('/customers', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Pelanggan dibuat');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat pelanggan')),
  });
}

// ---- Invoices ----
export function useInvoices(status?: string) {
  return useQuery({
    queryKey: ['invoices', status ?? 'all'],
    queryFn: async () => (await api.get<InvoiceListItem[]>('/finance/invoices', { params: status ? { status } : undefined })).data,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', 'detail', id],
    queryFn: async () => (await api.get<InvoiceDetail>(`/finance/invoices/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post<InvoiceListItem>('/finance/invoices', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      toast.success('Faktur dibuat');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal membuat faktur')),
  });
}

export function useAddPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { amount: string; paidAt: string; method?: string }) =>
      (await api.post(`/finance/invoices/${invoiceId}/payments`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      toast.success('Pembayaran dicatat');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal mencatat pembayaran')),
  });
}

// ---- Expenses ----
export function useExpenses(status?: string) {
  return useQuery({
    queryKey: ['expenses', status ?? 'all'],
    queryFn: async () => (await api.get<Expense[]>('/finance/expenses', { params: status ? { status } : undefined })).data,
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/finance/expense-categories')).data,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/finance/expenses', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      toast.success('Pengeluaran dicatat');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal mencatat pengeluaran')),
  });
}

export function useSetExpenseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.put(`/finance/expenses/${id}/status`, { status })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Status diperbarui');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal memperbarui status')),
  });
}

// ---- Reimbursements ----
export function useReimbursements(status?: string) {
  return useQuery({
    queryKey: ['reimbursements', status ?? 'all'],
    queryFn: async () => (await api.get<Reimbursement[]>('/finance/reimbursements', { params: status ? { status } : undefined })).data,
  });
}

export function useCreateReimbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/finance/reimbursements', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] });
      toast.success('Reimbursement diajukan');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal mengajukan reimbursement')),
  });
}

export function useDecideReimbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.put(`/finance/reimbursements/${id}/status`, { status })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      toast.success('Status diperbarui');
    },
    onError: (e) => toast.error(errMsg(e, 'Gagal memperbarui status')),
  });
}

// ---- Reports ----
export function useFinanceSummary() {
  return useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: async () => (await api.get<FinanceSummary>('/finance/reports/summary')).data,
  });
}

export function useCashflow() {
  return useQuery({
    queryKey: ['finance', 'cashflow'],
    queryFn: async () =>
      (await api.get<{ month: string; income: number; expense: number; net: number }[]>('/finance/reports/cashflow')).data,
  });
}

export function useExpenseByCategory() {
  return useQuery({
    queryKey: ['finance', 'expense-by-category'],
    queryFn: async () => (await api.get<{ category: string; amount: number }[]>('/finance/reports/expense-by-category')).data,
  });
}

/** Download a report export (xlsx/pdf) via authenticated blob request. */
export async function downloadReport(type: 'cashflow' | 'pnl' | 'expense', format: 'xlsx' | 'pdf') {
  const res = await api.get(`/finance/reports/${type}/export.${format}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

function errMsg(e: unknown, fallback: string) {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
