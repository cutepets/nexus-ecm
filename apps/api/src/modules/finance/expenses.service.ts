import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { NotificationService } from '../../core/notification/notification.service';
import {
  CreateExpenseDto,
  CreateReimbursementDto,
  ExpenseStatusDto,
  ReimbursementDecisionDto,
} from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  listCategories() {
    return this.prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  }

  presignReceipt(fileName: string) {
    return this.storage.presignedUpload(this.storage.buildKey('finance/receipts', fileName));
  }

  // ---- Expenses ----

  list(status?: string) {
    return this.prisma.expense.findMany({
      where: status ? { status: status as Prisma.ExpenseWhereInput['status'] } : undefined,
      include: { category: true, recordedBy: { select: { id: true, fullName: true } } },
      orderBy: { spentAt: 'desc' },
    });
  }

  async createExpense(dto: CreateExpenseDto, recordedById: string | undefined, ctx: AuditContext) {
    const expense = await this.prisma.expense.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        amount: new Prisma.Decimal(dto.amount),
        spentAt: new Date(dto.spentAt),
        receiptUrl: dto.receiptUrl,
        recordedById,
        status: 'DRAFT',
      },
      include: { category: true },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Expense', entityId: expense.id, after: expense, ctx });
    return expense;
  }

  async setExpenseStatus(id: string, dto: ExpenseStatusDto, ctx: AuditContext) {
    const before = await this.prisma.expense.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Expense not found');
    const expense = await this.prisma.expense.update({ where: { id }, data: { status: dto.status } });
    await this.audit.record({ action: dto.status === 'APPROVED' ? 'APPROVE' : 'UPDATE', entity: 'Expense', entityId: id, after: { status: dto.status }, ctx });
    return expense;
  }

  async removeExpense(id: string, ctx: AuditContext) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    await this.prisma.expense.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Expense', entityId: id, before: expense, ctx });
    return { success: true };
  }

  // ---- Reimbursements ----

  listReimbursements(status?: string) {
    return this.prisma.reimbursement.findMany({
      where: status ? { status: status as Prisma.ReimbursementWhereInput['status'] } : undefined,
      include: { employee: { select: { id: true, fullName: true, employeeNo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReimbursement(dto: CreateReimbursementDto, ctx: AuditContext) {
    const reimb = await this.prisma.reimbursement.create({
      data: {
        employeeId: dto.employeeId,
        title: dto.title,
        amount: new Prisma.Decimal(dto.amount),
        receiptUrl: dto.receiptUrl,
        status: 'PENDING',
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Reimbursement', entityId: reimb.id, after: reimb, ctx });
    await this.notify.notifyRole('FINANCE', {
      type: 'REIMBURSEMENT',
      title: 'Reimbursement baru menunggu persetujuan',
      body: `${dto.title} — ${dto.amount}`,
      data: { reimbursementId: reimb.id },
    });
    return reimb;
  }

  async decideReimbursement(id: string, dto: ReimbursementDecisionDto, approverEmployeeId: string | undefined, ctx: AuditContext) {
    const before = await this.prisma.reimbursement.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Reimbursement not found');

    const reimb = await this.prisma.reimbursement.update({
      where: { id },
      data: { status: dto.status, approverId: approverEmployeeId },
    });

    // When paid, mirror it into the expense ledger under the REIMBURSEMENT category.
    if (dto.status === 'PAID') {
      const cat = await this.prisma.expenseCategory.findUnique({ where: { name: 'REIMBURSEMENT' } });
      if (cat) {
        await this.prisma.expense.create({
          data: {
            categoryId: cat.id,
            title: `Reimbursement: ${reimb.title}`,
            amount: reimb.amount,
            spentAt: new Date(),
            recordedById: reimb.employeeId,
            status: 'PAID',
          },
        });
      }
    }

    await this.audit.record({
      action: dto.status === 'REJECTED' ? 'REJECT' : dto.status === 'APPROVED' ? 'APPROVE' : 'UPDATE',
      entity: 'Reimbursement',
      entityId: id,
      after: { status: dto.status },
      ctx,
    });
    await this.notify.notifyEmployee(reimb.employeeId, {
      type: 'REIMBURSEMENT',
      title: `Reimbursement ${dto.status}`,
      body: reimb.title,
      data: { reimbursementId: id },
    });
    return reimb;
  }
}
