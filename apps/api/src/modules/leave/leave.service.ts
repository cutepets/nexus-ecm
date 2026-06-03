import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { NotificationService } from '../../core/notification/notification.service';
import { CreateLeaveRequestDto, DecisionDto, LeaveQueryDto } from './dto/leave.dto';

// Multi-step chain: Employee → Supervisor → Manager → HR.
const APPROVAL_STEPS = [
  { step: 1, role: 'SUPERVISOR' },
  { step: 2, role: 'MANAGER' },
  { step: 3, role: 'HR' },
] as const;
const MAX_STEP = APPROVAL_STEPS.length;

const REQUEST_INCLUDE = {
  employee: { select: { id: true, fullName: true, employeeNo: true, managerId: true } },
  leaveType: { select: { id: true, name: true, requiresDoc: true } },
  approvals: {
    orderBy: { step: 'asc' as const },
    include: { approver: { select: { id: true, fullName: true } } },
  },
};

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  listTypes() {
    return this.prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  }

  async balances(employeeId: string) {
    const year = new Date().getFullYear();
    const balances = await this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: { select: { id: true, name: true } } },
    });
    return balances.map((b) => ({ ...b, remaining: b.allocated - b.used }));
  }

  async presignDoc(fileName: string) {
    const key = this.storage.buildKey('leave/documents', fileName);
    return this.storage.presignedUpload(key);
  }

  async list(query: LeaveQueryDto) {
    return this.prisma.leaveRequest.findMany({
      where: {
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Approval inbox: requests still pending a decision. */
  async inbox() {
    return this.prisma.leaveRequest.findMany({
      where: { status: 'PENDING' },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!request) throw new NotFoundException('Leave request not found');
    return request;
  }

  async create(dto: CreateLeaveRequestDto, ctx: AuditContext) {
    if (!dto.employeeId) throw new BadRequestException('employeeId is required');
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, fullName: true, managerId: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new BadRequestException('Leave type not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('endDate must be on or after startDate');
    const days = this.daysInclusive(start, end);

    if (leaveType.requiresDoc && !dto.documentUrl) {
      throw new BadRequestException(`${leaveType.name} requires a supporting document`);
    }

    // Quota check for allowance-based types.
    if (leaveType.defaultQuota > 0) {
      const balance = await this.ensureBalance(employee.id, leaveType.id, leaveType.defaultQuota, start.getFullYear());
      if (balance.allocated - balance.used < days) {
        throw new BadRequestException('Insufficient leave balance');
      }
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        reason: dto.reason,
        documentUrl: dto.documentUrl,
        currentStep: 1,
        approvals: {
          create: APPROVAL_STEPS.map((s) => ({
            step: s.step,
            role: s.role,
            // Pre-assign the supervisor step to the requester's direct manager.
            approverId: s.step === 1 ? employee.managerId : undefined,
          })),
        },
      },
      include: REQUEST_INCLUDE,
    });

    await this.audit.record({ action: 'CREATE', entity: 'LeaveRequest', entityId: request.id, after: request, ctx });

    // Notify first approver and confirm to requester.
    if (employee.managerId) {
      await this.notify.notifyEmployee(employee.managerId, {
        type: 'LEAVE_APPROVAL',
        title: 'Pengajuan cuti menunggu persetujuan',
        body: `${employee.fullName} mengajukan ${leaveType.name} (${days} hari)`,
        data: { requestId: request.id, step: 1 },
      });
    } else {
      await this.notify.notifyRole('MANAGER', {
        type: 'LEAVE_APPROVAL',
        title: 'Pengajuan cuti menunggu persetujuan',
        body: `${employee.fullName} mengajukan ${leaveType.name} (${days} hari)`,
        data: { requestId: request.id, step: 1 },
      });
    }
    await this.notify.notifyEmployee(employee.id, {
      type: 'LEAVE_SUBMITTED',
      title: 'Pengajuan cuti terkirim',
      body: `Pengajuan ${leaveType.name} Anda sedang diproses`,
      data: { requestId: request.id },
    });

    return request;
  }

  async decide(id: string, dto: DecisionDto, actorUserId: string, ctx: AuditContext) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request already finalized');

    const current = request.approvals.find((a) => a.step === request.currentStep);
    if (!current) throw new BadRequestException('No pending approval step');

    const approverId = await this.resolveActorEmployeeId(actorUserId);

    await this.prisma.leaveApproval.update({
      where: { id: current.id },
      data: { decision: dto.decision, comment: dto.comment, approverId, decidedAt: new Date() },
    });

    if (dto.decision === 'REJECTED') {
      await this.prisma.leaveRequest.update({ where: { id }, data: { status: 'REJECTED' } });
      await this.audit.record({ action: 'REJECT', entity: 'LeaveRequest', entityId: id, ctx });
      await this.notify.notifyEmployee(request.employeeId, {
        type: 'LEAVE_REJECTED',
        title: 'Pengajuan cuti ditolak',
        body: `Pengajuan ${request.leaveType.name} Anda ditolak${dto.comment ? `: ${dto.comment}` : ''}`,
        data: { requestId: id },
      });
      return this.getById(id);
    }

    // Approved this step.
    if (request.currentStep < MAX_STEP) {
      const nextStep = request.currentStep + 1;
      await this.prisma.leaveRequest.update({ where: { id }, data: { currentStep: nextStep } });
      const nextRole = APPROVAL_STEPS[nextStep - 1].role;
      await this.notify.notifyRole(nextRole === 'SUPERVISOR' ? 'MANAGER' : nextRole, {
        type: 'LEAVE_APPROVAL',
        title: 'Pengajuan cuti menunggu persetujuan',
        body: `${request.employee.fullName} — ${request.leaveType.name}`,
        data: { requestId: id, step: nextStep },
      });
    } else {
      // Final approval → finalize and deduct balance.
      await this.prisma.leaveRequest.update({ where: { id }, data: { status: 'APPROVED' } });
      await this.deductBalance(request.employeeId, request.leaveTypeId, request.startDate, request.endDate);
      await this.notify.notifyEmployee(request.employeeId, {
        type: 'LEAVE_APPROVED',
        title: 'Pengajuan cuti disetujui',
        body: `Pengajuan ${request.leaveType.name} Anda telah disetujui`,
        data: { requestId: id },
      });
    }

    await this.audit.record({ action: 'APPROVE', entity: 'LeaveRequest', entityId: id, after: { step: request.currentStep }, ctx });
    return this.getById(id);
  }

  /** Requester withdraws a request that's still pending. */
  async remove(id: string, ctx: AuditContext) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') throw new ForbiddenException('Only pending requests can be withdrawn');

    await this.prisma.leaveRequest.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'LeaveRequest', entityId: id, before: request, ctx });
    return { success: true };
  }

  // ---- helpers ----

  private async ensureBalance(employeeId: string, leaveTypeId: string, allocated: number, year: number) {
    return this.prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      update: {},
      create: { employeeId, leaveTypeId, year, allocated, used: 0 },
    });
  }

  private async deductBalance(employeeId: string, leaveTypeId: string, start: Date, end: Date) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || leaveType.defaultQuota <= 0) return; // non-allowance types aren't tracked
    const year = new Date(start).getFullYear();
    const days = this.daysInclusive(start, end);
    await this.ensureBalance(employeeId, leaveTypeId, leaveType.defaultQuota, year);
    await this.prisma.leaveBalance.update({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      data: { used: { increment: days } },
    });
  }

  private async resolveActorEmployeeId(userId: string): Promise<string | undefined> {
    const employee = await this.prisma.employee.findFirst({ where: { userId }, select: { id: true } });
    return employee?.id;
  }

  private daysInclusive(start: Date, end: Date): number {
    const ms = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    return Math.floor(ms / 86_400_000) + 1;
  }
}
