import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { AddPaymentDto, CreateInvoiceDto, InvoiceQueryDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';

const DETAIL_INCLUDE = {
  customer: { select: { id: true, name: true, company: true } },
  items: true,
  payments: { orderBy: { paidAt: 'asc' as const } },
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: InvoiceQueryDto) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(query.status ? { status: query.status as Prisma.InvoiceWhereInput['status'] } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: { customer: { select: { id: true, name: true } }, payments: true },
      orderBy: { issueDate: 'desc' },
    });
    // Derive OVERDUE on read (don't mutate stored status for unpaid past-due).
    const now = new Date();
    return invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
      const isOverdue = inv.dueDate < now && paid.lessThan(inv.total) && inv.status !== 'PAID' && inv.status !== 'VOID';
      return {
        ...inv,
        paid: paid.toString(),
        status: isOverdue ? 'OVERDUE' : inv.status,
      };
    });
  }

  async getById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const paid = invoice.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    return { ...invoice, paid: paid.toString() };
  }

  async create(dto: CreateInvoiceDto, ctx: AuditContext) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new BadRequestException('Customer not found');

    const items = dto.items.map((it) => ({
      description: it.description,
      quantity: new Prisma.Decimal(it.quantity),
      unitPrice: new Prisma.Decimal(it.unitPrice),
      lineTotal: new Prisma.Decimal(it.quantity).mul(it.unitPrice),
    }));
    const subtotal = items.reduce((s, it) => s.add(it.lineTotal), new Prisma.Decimal(0));
    const tax = subtotal.mul(dto.taxRate ?? 0).div(100);
    const total = subtotal.add(tax);

    const invoice = await this.prisma.invoice.create({
      data: {
        number: await this.nextNumber(dto.issueDate),
        customerId: dto.customerId,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        subtotal,
        tax,
        total,
        status: 'DRAFT',
        items: { create: items },
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({ action: 'CREATE', entity: 'Invoice', entityId: invoice.id, after: { number: invoice.number, total: total.toString() }, ctx });
    return invoice;
  }

  async setStatus(id: string, dto: UpdateInvoiceStatusDto, ctx: AuditContext) {
    await this.getById(id);
    const invoice = await this.prisma.invoice.update({ where: { id }, data: { status: dto.status } });
    await this.audit.record({ action: 'UPDATE', entity: 'Invoice', entityId: id, after: { status: dto.status }, ctx });
    return invoice;
  }

  async addPayment(invoiceId: string, dto: AddPaymentDto, ctx: AuditContext) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const amount = new Prisma.Decimal(dto.amount);
    const alreadyPaid = invoice.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    const newPaid = alreadyPaid.add(amount);

    const status = newPaid.greaterThanOrEqualTo(invoice.total)
      ? 'PAID'
      : newPaid.greaterThan(0)
        ? 'PARTIAL'
        : invoice.status;

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId,
          amount,
          paidAt: new Date(dto.paidAt),
          method: dto.method,
          reference: dto.reference,
        },
      }),
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status } }),
    ]);

    await this.audit.record({ action: 'UPDATE', entity: 'Invoice', entityId: invoiceId, after: { payment: amount.toString(), status }, ctx });
    return { payment, status, paid: newPaid.toString() };
  }

  /** Generate INV-YYYY-#### sequential per year. */
  private async nextNumber(issueDate: string) {
    const year = new Date(issueDate).getFullYear();
    const prefix = `INV-${year}-`;
    const last = await this.prisma.invoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const lastNum = last ? Number(last.number.slice(prefix.length)) : 0;
    return `${prefix}${String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(4, '0')}`;
  }
}
