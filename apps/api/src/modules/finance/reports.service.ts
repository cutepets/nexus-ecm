import { Injectable } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../core/prisma/prisma.service';

type ReportType = 'cashflow' | 'pnl' | 'expense';

interface ReportData {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

const idr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const end = to ? new Date(to) : new Date(new Date().getFullYear(), 11, 31);
    return { start, end };
  }

  /** Finance dashboard summary. */
  async summary(from?: string, to?: string) {
    const { start, end } = this.range(from, to);
    const [payments, expenses, invoices] = await Promise.all([
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: start, lte: end } } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { spentAt: { gte: start, lte: end } } }),
      this.prisma.invoice.findMany({ where: { status: { notIn: ['PAID', 'VOID'] } }, include: { payments: true } }),
    ]);

    const income = Number(payments._sum.amount ?? 0);
    const expense = Number(expenses._sum.amount ?? 0);
    const outstanding = invoices.reduce((s, inv) => {
      const paid = inv.payments.reduce((a, p) => a.add(p.amount), new Prisma.Decimal(0));
      return s + Number(inv.total) - Number(paid);
    }, 0);

    return { income, expense, net: income - expense, outstanding };
  }

  /** Monthly income vs expense across the range. */
  async cashflow(from?: string, to?: string) {
    const { start, end } = this.range(from, to);
    const [payments, expenses] = await Promise.all([
      this.prisma.payment.findMany({ where: { paidAt: { gte: start, lte: end } }, select: { amount: true, paidAt: true } }),
      this.prisma.expense.findMany({ where: { spentAt: { gte: start, lte: end } }, select: { amount: true, spentAt: true } }),
    ]);

    const months = new Map<string, { income: number; expense: number }>();
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const p of payments) {
      const k = key(p.paidAt);
      const m = months.get(k) ?? { income: 0, expense: 0 };
      m.income += Number(p.amount);
      months.set(k, m);
    }
    for (const e of expenses) {
      const k = key(e.spentAt);
      const m = months.get(k) ?? { income: 0, expense: 0 };
      m.expense += Number(e.amount);
      months.set(k, m);
    }
    return [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, income: v.income, expense: v.expense, net: v.income - v.expense }));
  }

  async expenseByCategory(from?: string, to?: string) {
    const { start, end } = this.range(from, to);
    const grouped = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: { spentAt: { gte: start, lte: end } },
    });
    const categories = await this.prisma.expenseCategory.findMany();
    const nameOf = new Map(categories.map((c) => [c.id, c.name]));
    return grouped.map((g) => ({ category: nameOf.get(g.categoryId) ?? g.categoryId, amount: Number(g._sum.amount ?? 0) }));
  }

  // ---- Report assembly + export ----

  private async build(type: ReportType, from?: string, to?: string): Promise<ReportData> {
    if (type === 'cashflow') {
      const rows = (await this.cashflow(from, to)).map((r) => [r.month, idr(r.income), idr(r.expense), idr(r.net)]);
      return { title: 'Laporan Arus Kas', columns: ['Bulan', 'Pemasukan', 'Pengeluaran', 'Net'], rows };
    }
    if (type === 'expense') {
      const rows = (await this.expenseByCategory(from, to)).map((r) => [r.category, idr(r.amount)]);
      return { title: 'Laporan Pengeluaran per Kategori', columns: ['Kategori', 'Jumlah'], rows };
    }
    const s = await this.summary(from, to);
    return {
      title: 'Laporan Laba Rugi (P&L)',
      columns: ['Keterangan', 'Jumlah'],
      rows: [
        ['Pendapatan', idr(s.income)],
        ['Pengeluaran', idr(s.expense)],
        ['Laba Bersih', idr(s.net)],
      ],
    };
  }

  async toExcel(type: ReportType, from?: string, to?: string): Promise<Buffer> {
    const data = await this.build(type, from, to);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    ws.addRow([data.title]);
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.addRow([]);
    const header = ws.addRow(data.columns);
    header.font = { bold: true };
    data.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 24));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async toPdf(type: ReportType, from?: string, to?: string): Promise<Buffer> {
    const data = await this.build(type, from, to);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Nexus ECM', { continued: false });
      doc.fontSize(14).text(data.title);
      doc.moveDown();

      const colWidth = (doc.page.width - 80) / data.columns.length;
      doc.fontSize(11).font('Helvetica-Bold');
      data.columns.forEach((c, i) => doc.text(c, 40 + i * colWidth, doc.y, { width: colWidth, continued: i < data.columns.length - 1 }));
      doc.moveDown(0.5);
      doc.font('Helvetica');
      data.rows.forEach((row) => {
        const y = doc.y;
        row.forEach((cell, i) =>
          doc.text(String(cell), 40 + i * colWidth, y, { width: colWidth, continued: i < row.length - 1 }),
        );
        doc.moveDown(0.3);
      });

      doc.end();
    });
  }
}
