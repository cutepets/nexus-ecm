import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { AssignEmployeeScheduleDto, ReorderSchedulesDto, UpsertEmployeeScheduleOverrideDto, UpsertScheduleDto } from './dto/schedule.dto';
import { ScheduleResolverService } from './schedule-resolver.service';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly resolver: ScheduleResolverService,
  ) {}

  list() {
    return this.prisma.workSchedule.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
  }

  async create(dto: UpsertScheduleDto, ctx: AuditContext) {
    this.validateSplitShift(dto);
    const last = await this.prisma.workSchedule.aggregate({ _max: { displayOrder: true } });
    const schedule = await this.prisma.workSchedule.create({
      data: { ...dto, displayOrder: dto.displayOrder ?? (last._max.displayOrder ?? -1) + 1 },
    });
    await this.audit.record({
      action: 'CREATE',
      entity: 'WorkSchedule',
      entityId: schedule.id,
      after: schedule,
      ctx,
    });
    return schedule;
  }

  async update(id: string, dto: UpsertScheduleDto, ctx: AuditContext) {
    const before = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy ca làm');
    this.validateSplitShift(dto);
    const schedule = await this.prisma.workSchedule.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      action: 'UPDATE',
      entity: 'WorkSchedule',
      entityId: id,
      before,
      after: schedule,
      ctx,
    });
    return schedule;
  }

  async remove(id: string, ctx: AuditContext) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
    });
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeScheduleOverride.deleteMany({ where: { workScheduleId: id } });
      await tx.employeeWorkScheduleAssignment.deleteMany({ where: { workScheduleId: id } });
      await tx.employeeDailySchedule.deleteMany({ where: { workScheduleId: id } });
      await tx.workSchedule.delete({ where: { id } });
    });
    await this.audit.record({
      action: 'DELETE',
      entity: 'WorkSchedule',
      entityId: id,
      before: schedule,
      ctx,
    });
    return { success: true };
  }

  async reorder(dto: ReorderSchedulesDto, ctx: AuditContext) {
    const existing = await this.prisma.workSchedule.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((schedule) => schedule.id));
    if (dto.scheduleIds.length !== existing.length || dto.scheduleIds.some((id) => !existingIds.has(id)))
      throw new BadRequestException('Danh sách sắp xếp ca không hợp lệ');
    await this.prisma.$transaction(
      dto.scheduleIds.map((id, displayOrder) =>
        this.prisma.workSchedule.update({ where: { id }, data: { displayOrder } }),
      ),
    );
    await this.audit.record({ action: 'UPDATE', entity: 'WorkScheduleOrder', entityId: 'all', after: dto.scheduleIds, ctx });
    return this.list();
  }

  async listAssignments(employeeId?: string) {
    return this.prisma.employeeWorkScheduleAssignment.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
        workSchedule: true,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async assignEmployee(dto: AssignEmployeeScheduleDto, ctx: AuditContext) {
    const effectiveFrom = this.dateOnly(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? this.dateOnly(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('Ngày kết thúc phải từ ngày bắt đầu trở đi');
    }

    const [employee, schedule] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: dto.employeeId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.workSchedule.findUnique({
        where: { id: dto.workScheduleId },
        select: { id: true },
      }),
    ]);
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');

    const weekdays = [...new Set(dto.weekdays ?? [])].sort((a, b) => a - b);
    const existing = await this.prisma.employeeWorkScheduleAssignment.findMany({
      where: {
        employeeId: dto.employeeId,
        effectiveFrom: {
          lte: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z'),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
      },
      select: { id: true, weekdays: true },
    });
    if (existing.some((assignment) => this.weekdaysOverlap(weekdays, assignment.weekdays))) {
      throw new BadRequestException('Nhân viên đã có ca trùng ngày hiệu lực và ngày trong tuần');
    }

    const assignment = await this.prisma.employeeWorkScheduleAssignment.create({
      data: {
        employeeId: dto.employeeId,
        workScheduleId: dto.workScheduleId,
        effectiveFrom,
        effectiveTo,
        weekdays,
        priority: dto.priority ?? 0,
        note: dto.note,
      },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
        workSchedule: true,
      },
    });
    await this.audit.record({
      action: 'CREATE',
      entity: 'EmployeeWorkScheduleAssignment',
      entityId: assignment.id,
      after: assignment,
      ctx,
    });
    return assignment;
  }

  async removeAssignment(id: string, ctx: AuditContext) {
    const assignment = await this.prisma.employeeWorkScheduleAssignment.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
        workSchedule: true,
      },
    });
    if (!assignment) throw new NotFoundException('Không tìm thấy phân công ca làm');
    await this.prisma.employeeWorkScheduleAssignment.delete({ where: { id } });
    await this.audit.record({
      action: 'DELETE',
      entity: 'EmployeeWorkScheduleAssignment',
      entityId: id,
      before: assignment,
      ctx,
    });
    return { success: true };
  }

  async listOverrides(employeeId?: string, workDate?: string) {
    return this.prisma.employeeScheduleOverride.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(workDate ? { workDate: this.dateOnly(workDate) } : {}),
      },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
        workSchedule: true,
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async setOverride(dto: UpsertEmployeeScheduleOverrideDto, ctx: AuditContext) {
    const workDate = this.dateOnly(dto.workDate);
    const [employee, schedule] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, deletedAt: null }, select: { id: true } }),
      this.prisma.workSchedule.findUnique({ where: { id: dto.workScheduleId }, select: { id: true } }),
    ]);
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    const before = await this.prisma.employeeScheduleOverride.findUnique({
      where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
    });
    const override = await this.prisma.employeeScheduleOverride.upsert({
      where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
      create: {
        employeeId: dto.employeeId,
        workDate,
        workScheduleId: dto.workScheduleId,
        note: dto.note,
        createdById: ctx.actorId,
      },
      update: { workScheduleId: dto.workScheduleId, note: dto.note, createdById: ctx.actorId },
      include: { employee: { select: { id: true, employeeNo: true, fullName: true } }, workSchedule: true },
    });
    await this.audit.record({
      action: before ? 'UPDATE' : 'CREATE',
      entity: 'EmployeeScheduleOverride',
      entityId: override.id,
      before: before ?? undefined,
      after: override,
      ctx,
    });
    return override;
  }

  async removeOverride(id: string, ctx: AuditContext) {
    const override = await this.prisma.employeeScheduleOverride.findUnique({ where: { id } });
    if (!override) throw new NotFoundException('Không tìm thấy lịch ghi đè theo ngày');
    await this.prisma.employeeScheduleOverride.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'EmployeeScheduleOverride', entityId: id, before: override, ctx });
    return { success: true };
  }

  resolve(employeeId: string, workDate: string) {
    return this.resolver.resolve(employeeId, this.dateOnly(workDate));
  }

  private validateSplitShift(dto: UpsertScheduleDto) {
    const hasSecondStart = Boolean(dto.secondStartTime);
    const hasSecondEnd = Boolean(dto.secondEndTime);
    if (hasSecondStart !== hasSecondEnd) throw new BadRequestException('Ca gãy cần đủ giờ bắt đầu và kết thúc của ca thứ hai');
    if (!hasSecondStart || !dto.secondStartTime || !dto.secondEndTime) return;
    if (dto.secondStartTime <= dto.endTime) throw new BadRequestException('Ca thứ hai phải bắt đầu sau khi ca thứ nhất kết thúc');
    if (dto.secondEndTime <= dto.secondStartTime) throw new BadRequestException('Giờ kết thúc ca thứ hai phải sau giờ bắt đầu');
  }

  private dateOnly(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private weekdaysOverlap(left: number[], right: number[]) {
    if (left.length === 0 || right.length === 0) return true;
    return left.some((day) => right.includes(day));
  }
}
