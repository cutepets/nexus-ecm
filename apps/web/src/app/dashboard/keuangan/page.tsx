'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, Wallet, FileClock, Download, Check, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard } from '@/components/charts/chart-card';
import { BarChart } from '@/components/charts/bar-chart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useFinanceSummary,
  useCashflow,
  useExpenseByCategory,
  useInvoices,
  useExpenses,
  useReimbursements,
  useSetExpenseStatus,
  useDecideReimbursement,
  downloadReport,
  type InvoiceListItem,
  type Expense,
  type Reimbursement,
} from '@/features/finance/api';
import { InvoiceCreateDialog } from '@/features/finance/invoice-create-dialog';
import { ExpenseCreateDialog } from '@/features/finance/expense-create-dialog';
import { ReimbursementCreateDialog } from '@/features/finance/reimbursement-create-dialog';

export default function KeuanganPage() {
  const router = useRouter();
  const { data: summary } = useFinanceSummary();
  const { data: cashflow } = useCashflow();
  const { data: byCat } = useExpenseByCategory();
  const { data: invoices, isLoading: invLoading } = useInvoices();
  const { data: expenses, isLoading: expLoading } = useExpenses();
  const { data: reimbs, isLoading: rbLoading } = useReimbursements();
  const setExpStatus = useSetExpenseStatus();
  const decideRb = useDecideReimbursement();

  const cashflowData = useMemo(
    () => (cashflow ?? []).map((c) => ({ month: c.month.slice(5), Pemasukan: c.income, Pengeluaran: c.expense })),
    [cashflow],
  );
  const catData = useMemo(() => (byCat ?? []).map((c) => ({ category: c.category, jumlah: c.amount })), [byCat]);

  const invoiceCols = useMemo<ColumnDef<InvoiceListItem>[]>(
    () => [
      { accessorKey: 'number', header: 'Nomor', cell: ({ row }) => <span className="font-medium">{row.original.number}</span> },
      { id: 'customer', header: 'Pelanggan', cell: ({ row }) => row.original.customer.name },
      { id: 'total', header: 'Total', cell: ({ row }) => formatCurrency(Number(row.original.total)) },
      { id: 'paid', header: 'Dibayar', cell: ({ row }) => formatCurrency(Number(row.original.paid)) },
      { id: 'due', header: 'Jatuh Tempo', cell: ({ row }) => formatDate(row.original.dueDate) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  const expenseCols = useMemo<ColumnDef<Expense>[]>(
    () => [
      { accessorKey: 'title', header: 'Judul', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
      { id: 'cat', header: 'Kategori', cell: ({ row }) => row.original.category.name },
      { id: 'amount', header: 'Nominal', cell: ({ row }) => formatCurrency(Number(row.original.amount)) },
      { id: 'date', header: 'Tanggal', cell: ({ row }) => formatDate(row.original.spentAt) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status === 'DRAFT' ? (
            <Button size="sm" variant="secondary" onClick={() => setExpStatus.mutate({ id: row.original.id, status: 'APPROVED' })}>
              Setujui
            </Button>
          ) : row.original.status === 'APPROVED' ? (
            <Button size="sm" variant="secondary" onClick={() => setExpStatus.mutate({ id: row.original.id, status: 'PAID' })}>
              Tandai Dibayar
            </Button>
          ) : null,
      },
    ],
    [setExpStatus],
  );

  const reimbCols = useMemo<ColumnDef<Reimbursement>[]>(
    () => [
      { id: 'emp', header: 'Karyawan', cell: ({ row }) => row.original.employee.fullName },
      { accessorKey: 'title', header: 'Judul' },
      { id: 'amount', header: 'Nominal', cell: ({ row }) => formatCurrency(Number(row.original.amount)) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status === 'PENDING' ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => decideRb.mutate({ id: row.original.id, status: 'APPROVED' })}>
                <Check /> Setujui
              </Button>
              <Button size="sm" variant="ghost" onClick={() => decideRb.mutate({ id: row.original.id, status: 'REJECTED' })}>
                <X /> Tolak
              </Button>
            </div>
          ) : row.original.status === 'APPROVED' ? (
            <Button size="sm" variant="secondary" onClick={() => decideRb.mutate({ id: row.original.id, status: 'PAID' })}>
              Bayar
            </Button>
          ) : null,
      },
    ],
    [decideRb],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keuangan"
        description="Faktur, pengeluaran, dan laporan"
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Download /> Ekspor Laporan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => downloadReport('cashflow', 'xlsx')}>Arus Kas (Excel)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => downloadReport('pnl', 'pdf')}>Laba Rugi (PDF)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => downloadReport('expense', 'xlsx')}>Pengeluaran (Excel)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Pemasukan" value={formatCurrency(summary?.income ?? 0)} icon={TrendingUp} accent="mint" />
        <KpiCard label="Pengeluaran" value={formatCurrency(summary?.expense ?? 0)} icon={TrendingDown} accent="pink" />
        <KpiCard label="Laba Bersih" value={formatCurrency(summary?.net ?? 0)} icon={Wallet} accent="purple" />
        <KpiCard label="Piutang" value={formatCurrency(summary?.outstanding ?? 0)} icon={FileClock} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Arus Kas" description="Pemasukan vs pengeluaran per bulan">
          <BarChart
            data={cashflowData}
            xKey="month"
            series={[
              { key: 'Pemasukan', color: '#6EE7B7' },
              { key: 'Pengeluaran', color: '#F9A8D4' },
            ]}
            valueFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
          />
        </ChartCard>
        <ChartCard title="Pengeluaran per Kategori">
          <BarChart data={catData} xKey="category" series={[{ key: 'jumlah', label: 'Jumlah' }]} valueFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`} />
        </ChartCard>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Faktur</TabsTrigger>
          <TabsTrigger value="expenses">Pengeluaran</TabsTrigger>
          <TabsTrigger value="reimbursements">Reimbursement</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <div className="mb-3 flex justify-end">
            <InvoiceCreateDialog />
          </div>
          <DataTable
            columns={invoiceCols}
            data={invoices ?? []}
            loading={invLoading}
            searchPlaceholder="Cari faktur…"
            emptyTitle="Belum ada faktur"
            onRowClick={(r) => router.push(`/dashboard/keuangan/faktur/${r.id}`)}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <div className="mb-3 flex justify-end">
            <ExpenseCreateDialog />
          </div>
          <DataTable columns={expenseCols} data={expenses ?? []} loading={expLoading} searchPlaceholder="Cari pengeluaran…" emptyTitle="Belum ada pengeluaran" />
        </TabsContent>

        <TabsContent value="reimbursements">
          <div className="mb-3 flex justify-end">
            <ReimbursementCreateDialog />
          </div>
          <DataTable columns={reimbCols} data={reimbs ?? []} loading={rbLoading} searchPlaceholder="Cari…" emptyTitle="Belum ada reimbursement" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
