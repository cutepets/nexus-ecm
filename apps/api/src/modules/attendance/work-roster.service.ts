import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nexus/database';
import { workDateInTimeZone } from '../../common/utils/company-time';
import { AuditContext, AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { ApplyWorkScheduleRangeDto, BulkDeleteWorkRosterDto, CopyWorkRosterDayDto, UpdateDailyScheduleDto } from './dto/work-roster.dto';

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class WorkRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async generate(month: string, ctx: AuditContext) {
    const monthStart = this.monthStart(month);
    const monthEnd = this.monthEnd(monthStart);
    const roster = await this.prisma.workRosterMonth.upsert({
      where: { monthStart },
      create: { monthStart },
      update: {},
    });
    const setting = await this.prisma.companySetting.findUnique({ where: { id: 'default' }, select: { timezone: true } });
    const today = workDateInTimeZone(new Date(), setting?.timezone ?? 'Asia/Ho_Chi_Minh');

    const assignments = await this.prisma.employeeWorkScheduleAssignment.findMany({
      where: {
        effectiveFrom: { lte: monthEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
        employee: { deletedAt: null, workStatus: { notIn: ['INACTIVE', 'ABANDONED'] }, joinDate: { lte: monthEnd }, OR: [{ exitDate: null }, { exitDate: { gte: monthStart } }] },
      },
      include: {
        workSchedule: true,
        employee: {
          select: {
            id: true,
            primaryBranchId: true,
            branchAssignments: { where: { effectiveFrom: { lte: monthEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }] }, select: { branchId: true } },
          },
        },
      },
    });

    const existing = new Set((await this.prisma.employeeDailySchedule.findMany({ where: { rosterMonthId: roster.id }, select: { employeeId: true, workDate: true } })).map((entry) => `${entry.employeeId}:${this.dateKey(entry.workDate)}`));
    let created = 0;
    for (const assignment of assignments) {
      const branchIds = [...new Set([
        assignment.employee.primaryBranchId,
        ...assignment.employee.branchAssignments.map((branch) => branch.branchId),
      ].filter((branchId): branchId is string => Boolean(branchId)))];
      if (!branchIds.length) continue;
      for (let date = new Date(monthStart); date <= monthEnd; date.setUTCDate(date.getUTCDate() + 1)) {
        if (date < today) continue;
        if (date < assignment.effectiveFrom || (assignment.effectiveTo && date > assignment.effectiveTo)) continue;
        if (assignment.weekdays.length && !assignment.weekdays.includes(date.getUTCDay())) continue;
        const key = `${assignment.employeeId}:${this.dateKey(date)}`;
        if (existing.has(key)) continue;
        await this.createDay(this.prisma, {
          rosterMonthId: roster.id,
          employeeId: assignment.employeeId,
          workDate: new Date(date),
          schedule: assignment.workSchedule,
          branchIds: this.segmentTimes(assignment.workSchedule).map((_, index) => branchIds[index] ?? branchIds[0]),
          source: 'GENERATED',
        });
        existing.add(key);
        created += 1;
      }
    }
    await this.audit.record({ action: 'CREATE', entity: 'WorkRosterMonth', entityId: roster.id, after: { month: this.dateKey(monthStart), generated: created }, ctx });
    return { ...roster, generated: created };
  }

  async list(month: string, employeeId: string | null | undefined, canManage: boolean) {
    const monthStart = this.monthStart(month);
    const roster = await this.prisma.workRosterMonth.findUnique({ where: { monthStart } });
    if (!roster) return { month: this.dateKey(monthStart), branches: [], entries: [] };
    const visibleBranchIds = canManage
      ? null
      : [...new Set((await this.prisma.employeeDailySchedule.findMany({
          where: { rosterMonthId: roster.id, employeeId: employeeId ?? '__none__' },
          select: { segments: { select: { branchId: true } } },
        })).flatMap((schedule) => schedule.segments.map((segment) => segment.branchId)))];
    const allowedBranchIds = visibleBranchIds ?? [];
    if (!canManage && !allowedBranchIds.length)
      return { month: this.dateKey(monthStart), rosterId: roster.id, branches: [], entries: [] };
    const rosterWithEntries = await this.prisma.workRosterMonth.findUnique({
      where: { monthStart },
      include: {
        dailySchedules: {
          where: canManage ? undefined : { segments: { some: { branchId: { in: allowedBranchIds } } } },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeNo: true,
                photoUrl: true,
                employmentType: true,
                joinDate: true,
                exitDate: true,
                workStatus: true,
                user: { select: { avatarCropUrl: true } },
              },
            },
            segments: { include: { branch: { select: { id: true, code: true, name: true } } }, orderBy: { sequence: 'asc' } },
          },
          orderBy: [
            { workDate: 'asc' },
            { workSchedule: { displayOrder: 'asc' } },
            { employee: { fullName: 'asc' } },
          ],
        },
      },
    });
    if (!rosterWithEntries) return { month: this.dateKey(monthStart), branches: [], entries: [] };
    const branchMap = new Map<string, { id: string; code: string; name: string }>();
    rosterWithEntries.dailySchedules.forEach((entry) => entry.segments.forEach((segment) => {
      if (canManage || allowedBranchIds.includes(segment.branch.id)) branchMap.set(segment.branch.id, segment.branch);
    }));
    const photoKeys = [...new Set(rosterWithEntries.dailySchedules.flatMap((entry) => [entry.employee.photoUrl, entry.employee.user.avatarCropUrl]).filter((key): key is string => Boolean(key)))];
    const photoUrls = new Map(await Promise.all(photoKeys.map(async (key) => [key, await this.storage.presignedDownload(key, 3600)] as const)));
    const entries = rosterWithEntries.dailySchedules.map((entry) => ({
      ...entry,
      employee: {
        id: entry.employee.id,
        fullName: entry.employee.fullName,
        employeeNo: entry.employee.employeeNo,
        photoUrl: entry.employee.photoUrl ? photoUrls.get(entry.employee.photoUrl) ?? null : null,
        employmentType: entry.employee.employmentType,
        joinDate: entry.employee.joinDate,
        exitDate: entry.employee.exitDate,
        workStatus: entry.employee.workStatus,
        avatarUrl: entry.employee.user.avatarCropUrl
          ? photoUrls.get(entry.employee.user.avatarCropUrl) ?? null
          : entry.employee.photoUrl ? photoUrls.get(entry.employee.photoUrl) ?? null : null,
      },
    }));
    return { month: this.dateKey(monthStart), rosterId: rosterWithEntries.id, branches: [...branchMap.values()].sort((a, b) => a.name.localeCompare(b.name)), entries };
  }

  async updateDay(dto: UpdateDailyScheduleDto, ctx: AuditContext) {
    const workDate = this.workDate(dto.workDate);
    const record = await this.prisma.$transaction((tx) => this.upsertDay(tx, dto.employeeId, workDate, dto.workScheduleId, dto.branchIds, dto.note, 'MANAGER_EDITED', ctx.actorId));
    await this.audit.record({ action: 'UPDATE', entity: 'EmployeeDailySchedule', entityId: record.id, after: { workDate: dto.workDate, workScheduleId: dto.workScheduleId, branchIds: dto.branchIds }, ctx });
    return record;
  }

  async applyRange(dto: ApplyWorkScheduleRangeDto, ctx: AuditContext) {
    const fromDate = this.workDate(dto.fromDate);
    const toDate = this.workDate(dto.toDate);
    if (fromDate > toDate) throw new BadRequestException('NgÃ y káº¿t thÃºc pháº£i tá»« ngÃ y báº¯t Ä‘áº§u trá»Ÿ Ä‘i');
    const dayCount = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (dayCount > 366) throw new BadRequestException('Khoáº£ng ngÃ y khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 366 ngÃ y');

    const result = await this.prisma.$transaction(async (tx) => {
      let created = 0;
      let replaced = 0;
      let unchanged = 0;

      for (let offset = 0; offset < dayCount; offset += 1) {
        const workDate = new Date(fromDate);
        workDate.setUTCDate(workDate.getUTCDate() + offset);
        const existing = await tx.employeeDailySchedule.findUnique({
          where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
          select: { id: true, workScheduleId: true },
        });

        if (existing?.workScheduleId === dto.workScheduleId) {
          unchanged += 1;
          continue;
        }

        await this.upsertDay(tx, dto.employeeId, workDate, dto.workScheduleId, dto.branchIds, undefined, 'MANAGER_EDITED', ctx.actorId);
        if (existing) replaced += 1;
        else created += 1;
      }

      return { created, replaced, unchanged };
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'EmployeeDailyScheduleRange',
      entityId: dto.employeeId,
      after: { fromDate: dto.fromDate, toDate: dto.toDate, workScheduleId: dto.workScheduleId, branchIds: dto.branchIds, ...result },
      ctx,
    });
    return { fromDate: dto.fromDate, toDate: dto.toDate, ...result };
  }

  async bulkDelete(dto: BulkDeleteWorkRosterDto, ctx: AuditContext) {
    const dates = this.uniqueDates(dto.workDates);
    this.assertDateLimit(dates);
    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.employeeDailySchedule.deleteMany({
        where: {
          workDate: { in: dates },
          ...(dto.employeeId ? { employeeId: dto.employeeId } : {}),
          segments: { some: { branchId: dto.branchId } },
        },
      });
      return { deleted: deleted.count, days: dates.length };
    });
    await this.audit.record({
      action: 'DELETE',
      entity: 'EmployeeDailyScheduleBulk',
      entityId: dates.join(','),
      after: { ...result, employeeId: dto.employeeId ?? null },
      ctx,
    });
    return result;
  }

  async copyDay(dto: CopyWorkRosterDayDto, ctx: AuditContext) {
    const sourceDate = this.workDate(dto.sourceDate);
    const targetDates = this.uniqueDates(dto.targetDates).filter((date) => date.getTime() !== sourceDate.getTime());
    this.assertDateLimit(targetDates);
    const result = await this.prisma.$transaction(async (tx) => {
      const source = await tx.employeeDailySchedule.findMany({
        where: { workDate: sourceDate, segments: { some: { branchId: dto.branchId } } },
        include: { segments: { orderBy: { sequence: 'asc' } } },
      });
      let created = 0;
      let replaced = 0;
      for (const targetDate of targetDates) {
        for (const entry of source) {
          const existing = await tx.employeeDailySchedule.findUnique({
            where: { employeeId_workDate: { employeeId: entry.employeeId, workDate: targetDate } },
            select: { id: true },
          });
          await this.upsertDay(
            tx,
            entry.employeeId,
            targetDate,
            entry.workScheduleId,
            entry.segments.map((segment) => segment.branchId),
            entry.note ?? undefined,
            'MANAGER_EDITED',
            ctx.actorId,
          );
          if (existing) replaced += 1;
          else created += 1;
        }
      }
      return { sourceDate: dto.sourceDate, sourceEntries: source.length, targetDays: targetDates.length, created, replaced };
    });
    await this.audit.record({ action: 'UPDATE', entity: 'EmployeeDailyScheduleCopy', entityId: dto.sourceDate, after: result, ctx });
    return result;
  }

  private uniqueDates(values: string[]) {
    const dates = values.map((value) => this.workDate(value));
    return [...new Map(dates.map((date) => [this.dateKey(date), date])).values()].sort((a, b) => a.getTime() - b.getTime());
  }

  private assertDateLimit(dates: Date[]) {
    if (!dates.length) throw new BadRequestException('Cáº§n chá»n Ã­t nháº¥t má»™t ngÃ y');
    if (dates.length > 31) throw new BadRequestException('Chá»‰ Ä‘Æ°á»£c thao tÃ¡c tá»‘i Ä‘a 31 ngÃ y má»™t láº§n');
  }

  async upsertDay(tx: DbClient, employeeId: string, workDate: Date, workScheduleId: string, branchIds: string[], note: string | undefined, source: 'MANAGER_EDITED' | 'SHIFT_CHANGE_APPROVED', actorId?: string) {
    const roster = await this.ensureMonth(tx, this.firstOfMonth(workDate));
    const [employee, schedule] = await Promise.all([
      tx.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } }),
      tx.workSchedule.findUnique({ where: { id: workScheduleId } }),
    ]);
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
    if (!schedule) throw new NotFoundException('Không tìm thấy ca làm');
    const segments = this.segmentTimes(schedule);
    if (branchIds.length !== segments.length) throw new BadRequestException(`Ca ${segments.length === 2 ? 'gãy cần chọn cửa hàng cho cả hai khung giờ' : 'cần chọn một cửa hàng'}`);
    const branches = await tx.branch.findMany({ where: { id: { in: branchIds }, isActive: true }, select: { id: true } });
    if (branches.length !== new Set(branchIds).size) throw new BadRequestException('Có cửa hàng không tồn tại hoặc đã ngừng hoạt động');
    return tx.employeeDailySchedule.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      create: {
        rosterMonthId: roster.id, employeeId, workDate, workScheduleId, scheduleName: schedule.name, source, note, createdById: actorId,
        segments: { create: segments.map((segment, index) => ({ ...segment, branchId: branchIds[index] })) },
      },
      update: {
        rosterMonthId: roster.id, workScheduleId, scheduleName: schedule.name, source, note, createdById: actorId,
        segments: { deleteMany: {}, create: segments.map((segment, index) => ({ ...segment, branchId: branchIds[index] })) },
      },
      include: { segments: { include: { branch: true }, orderBy: { sequence: 'asc' } }, employee: { select: { id: true, fullName: true, employeeNo: true, photoUrl: true } } },
    });
  }

  private async ensureMonth(tx: DbClient, monthStart: Date) {
    return tx.workRosterMonth.upsert({ where: { monthStart }, create: { monthStart }, update: {} });
  }

  private async createDay(tx: DbClient, args: { rosterMonthId: string; employeeId: string; workDate: Date; schedule: { id: string; name: string; startTime: string; endTime: string; secondStartTime: string | null; secondEndTime: string | null }; branchIds: string[]; source: 'GENERATED' }) {
    return tx.employeeDailySchedule.create({
      data: { rosterMonthId: args.rosterMonthId, employeeId: args.employeeId, workDate: args.workDate, workScheduleId: args.schedule.id, scheduleName: args.schedule.name, source: args.source, segments: { create: this.segmentTimes(args.schedule).map((segment, index) => ({ ...segment, branchId: args.branchIds[index] })) } },
    });
  }

  private segmentTimes(schedule: { startTime: string; endTime: string; secondStartTime: string | null; secondEndTime: string | null }) {
    return [
      { sequence: 1, startTime: schedule.startTime, endTime: schedule.endTime },
      ...(schedule.secondStartTime && schedule.secondEndTime ? [{ sequence: 2, startTime: schedule.secondStartTime, endTime: schedule.secondEndTime }] : []),
    ];
  }
  private monthStart(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) throw new BadRequestException('Tháng phải có định dạng YYYY-MM');
    const date = new Date(`${value}-01T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Tháng không hợp lệ');
    return date;
  }
  private workDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || this.dateKey(date) !== value) throw new BadRequestException('Ngày không hợp lệ');
    return date;
  }
  private monthEnd(monthStart: Date) { return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)); }
  private firstOfMonth(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
  private dateKey(date: Date) { return date.toISOString().slice(0, 10); }
}
