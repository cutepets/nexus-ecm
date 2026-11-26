import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@nexus/database";
import { PrismaService } from "../../core/prisma/prisma.service";
import { AuditContext, AuditService } from "../../core/audit/audit.service";
import { minutesInTimeZone } from "../../common/utils/company-time";

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.timesheetPeriod.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: { startDate: "desc" },
    });
  }

  async create(
    startDateValue: string,
    endDateValue: string,
    ctx: AuditContext,
  ) {
    const startDate = this.day(startDateValue);
    const endDate = this.day(endDateValue);
    if (endDate < startDate)
      throw new BadRequestException(
        "Ngày kết thúc kỳ công phải sau ngày bắt đầu",
      );
    const period = await this.prisma.timesheetPeriod.create({
      data: { startDate, endDate },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "TimesheetPeriod",
      entityId: period.id,
      after: period,
      ctx,
    });
    return period;
  }

  async entries(id: string, employeeId?: string) {
    await this.getPeriod(id);
    return this.prisma.timesheetEntry.findMany({
      where: { periodId: id, ...(employeeId ? { employeeId } : {}) },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
      },
      orderBy: [{ employee: { fullName: "asc" } }, { workDate: "asc" }],
    });
  }

  async recalculate(id: string, ctx: AuditContext) {
    const period = await this.getPeriod(id);
    if (period.status === "LOCKED")
      throw new BadRequestException(
        "Kỳ bảng công đã chốt; hãy mở lại trước khi tính lại",
      );
    const [employees, attendances, config] = await Promise.all([
      this.prisma.employee.findMany({
        where: { deletedAt: null, workStatus: { not: "INACTIVE" } },
        select: { id: true },
      }),
      this.prisma.attendance.findMany({
        where: { workDate: { gte: period.startDate, lte: period.endDate } },
        include: {
          sessions: {
            select: { checkInAt: true, checkOutAt: true },
            orderBy: { sequence: "asc" },
          },
          overtimeRequests: {
            select: { status: true, requestedMinutes: true },
          },
        },
      }),
      this.prisma.companySetting.findUniqueOrThrow({
        where: { id: "default" },
        select: {
          timezone: true,
          workUnitMode: true,
          roundingMinutes: true,
          latePenaltyPerMinute: true,
          missingPunchPenalty: true,
        },
      }),
    ]);
    const attendanceByEmployeeDay = new Map(
      attendances.map((attendance) => [
        `${attendance.employeeId}:${this.isoDay(attendance.workDate)}`,
        attendance,
      ]),
    );
    let written = 0;
    for (const employee of employees) {
      for (
        let date = new Date(period.startDate);
        date <= period.endDate;
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        const workDate = new Date(date);
        const dailySchedule = await this.prisma.employeeDailySchedule.findUnique({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
          include: {
            workSchedule: true,
            segments: { orderBy: { sequence: "asc" }, select: { startTime: true, endTime: true } },
          },
        });
        const hasDailyRoster = Boolean(dailySchedule);
        const scheduleOverride = hasDailyRoster
          ? null
          : await this.prisma.employeeScheduleOverride.findUnique({
            where: { employeeId_workDate: { employeeId: employee.id, workDate } },
            include: { workSchedule: true },
          });
        const scheduleAssignment = hasDailyRoster || scheduleOverride
          ? null
          : await this.prisma.employeeWorkScheduleAssignment.findFirst({
            where: {
              employeeId: employee.id,
              effectiveFrom: { lte: workDate },
              AND: [
                {
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gte: workDate } },
                  ],
                },
                {
                  OR: [
                    { weekdays: { isEmpty: true } },
                    { weekdays: { has: workDate.getUTCDay() } },
                  ],
                },
              ],
            },
            include: { workSchedule: true },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          });
        const schedule = hasDailyRoster && dailySchedule
          ? {
              ...dailySchedule.workSchedule,
              name: dailySchedule.scheduleName,
              startTime: dailySchedule.segments[0]?.startTime ?? dailySchedule.workSchedule.startTime,
              endTime: dailySchedule.segments[0]?.endTime ?? dailySchedule.workSchedule.endTime,
              secondStartTime: dailySchedule.segments[1]?.startTime ?? null,
              secondEndTime: dailySchedule.segments[1]?.endTime ?? null,
            }
          : scheduleOverride?.workSchedule ?? scheduleAssignment?.workSchedule;
        if (!schedule) continue;
        const attendance = attendanceByEmployeeDay.get(
          `${employee.id}:${this.isoDay(workDate)}`,
        );
        const computed = this.computeEntry(
          schedule,
          attendance,
          config,
        );
        await this.prisma.timesheetEntry.upsert({
          where: {
            periodId_employeeId_workDate: {
              periodId: period.id,
              employeeId: employee.id,
              workDate,
            },
          },
          create: {
            periodId: period.id,
            employeeId: employee.id,
            workDate,
            attendanceId: attendance?.id,
            ...computed,
          },
          update: { attendanceId: attendance?.id ?? null, ...computed },
        });
        written++;
      }
    }
    await this.audit.record({
      action: "UPDATE",
      entity: "TimesheetPeriod",
      entityId: period.id,
      after: { recalculated: true, entries: written },
      ctx,
    });
    return { success: true, entries: written };
  }

  async submitReview(id: string, ctx: AuditContext) {
    const period = await this.getPeriod(id);
    if (period.status !== "DRAFT")
      throw new BadRequestException("Chỉ kỳ nháp mới có thể gửi duyệt");
    const updated = await this.prisma.timesheetPeriod.update({
      where: { id },
      data: { status: "REVIEW" },
    });
    await this.audit.record({
      action: "UPDATE",
      entity: "TimesheetPeriod",
      entityId: id,
      before: { status: period.status },
      after: { status: updated.status },
      ctx,
    });
    return updated;
  }

  async lock(id: string, ctx: AuditContext) {
    const period = await this.getPeriod(id);
    if (period.status !== "REVIEW")
      throw new BadRequestException(
        "Kỳ công phải ở trạng thái chờ duyệt trước khi chốt",
      );
    const updated = await this.prisma.timesheetPeriod.update({
      where: { id },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: ctx.actorId },
    });
    await this.audit.record({
      action: "APPROVE",
      entity: "TimesheetPeriod",
      entityId: id,
      before: { status: period.status },
      after: { status: updated.status },
      ctx,
    });
    return updated;
  }

  async reopen(id: string, reason: string, ctx: AuditContext) {
    const period = await this.getPeriod(id);
    if (period.status !== "LOCKED")
      throw new BadRequestException("Chỉ kỳ công đã chốt mới có thể mở lại");
    const updated = await this.prisma.timesheetPeriod.update({
      where: { id },
      data: {
        status: "DRAFT",
        reopenedAt: new Date(),
        reopenedById: ctx.actorId,
        reopenReason: reason,
        lockedAt: null,
        lockedById: null,
      },
    });
    await this.audit.record({
      action: "UPDATE",
      entity: "TimesheetPeriod",
      entityId: id,
      before: { status: period.status },
      after: { status: updated.status, reason },
      ctx,
    });
    return updated;
  }

  private async getPeriod(id: string) {
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { id },
    });
    if (!period) throw new NotFoundException("Không tìm thấy kỳ bảng công");
    return period;
  }

  private computeEntry(
    schedule: {
      startTime: string;
      endTime: string;
      secondStartTime: string | null;
      secondEndTime: string | null;
    },
    attendance:
      | {
          id: string;
          sessions: { checkInAt: Date; checkOutAt: Date | null }[];
          overtimeRequests: { status: string; requestedMinutes: number }[];
        }
      | undefined,
    config: {
      timezone: string;
      workUnitMode: string;
      roundingMinutes: number;
      latePenaltyPerMinute: Prisma.Decimal;
      missingPunchPenalty: Prisma.Decimal;
    },
  ) {
    const scheduledMinutes =
      this.segmentMinutes(schedule.startTime, schedule.endTime) +
      (schedule.secondStartTime && schedule.secondEndTime
        ? this.segmentMinutes(schedule.secondStartTime, schedule.secondEndTime)
        : 0);
    const segments = [
      { start: schedule.startTime, end: schedule.endTime },
      ...(schedule.secondStartTime && schedule.secondEndTime
        ? [{ start: schedule.secondStartTime, end: schedule.secondEndTime }]
        : []),
    ];
    const overtimeApproved = Boolean(
      attendance?.overtimeRequests.some((request) => request.status === "APPROVED"),
    );
    let workedMinutes = 0;
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    for (const [index, segment] of segments.entries()) {
      const session = attendance?.sessions[index];
      if (!session) continue;
      const startMinute = this.timeMinutes(segment.start);
      const endMinute = this.timeMinutes(segment.end);
      const checkInMinute = minutesInTimeZone(session.checkInAt, config.timezone);
      lateMinutes += Math.max(
        0,
        checkInMinute - startMinute,
      );
      if (!session.checkOutAt) continue;
      const checkOutMinute = minutesInTimeZone(session.checkOutAt, config.timezone);
      const effectiveStart = Math.max(checkInMinute, startMinute);
      const effectiveEnd = overtimeApproved
        ? checkOutMinute
        : Math.min(checkOutMinute, endMinute);
      workedMinutes += Math.max(0, effectiveEnd - effectiveStart);
      earlyLeaveMinutes += Math.max(
        0,
        endMinute - checkOutMinute,
      );
    }
    const roundedWorkMinutes = this.round(
      workedMinutes,
      config.roundingMinutes,
    );
    const missingPunch = Boolean(
      attendance && attendance.sessions.some((session) => !session.checkOutAt),
    );
    const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);
    const overtimeApprovedMinutes =
      attendance?.overtimeRequests
        .filter((request) => request.status === "APPROVED")
        .reduce((sum, request) => sum + request.requestedMinutes, 0) ?? 0;
    const workUnits =
      config.workUnitMode === "HOURLY"
        ? new Prisma.Decimal(roundedWorkMinutes).div(60)
        : new Prisma.Decimal(
            scheduledMinutes
              ? Math.min(1, roundedWorkMinutes / scheduledMinutes)
              : 0,
          );
    return {
      scheduledMinutes,
      workedMinutes,
      roundedWorkMinutes,
      workUnits,
      lateMinutes,
      earlyLeaveMinutes,
      latePenalty: new Prisma.Decimal(lateMinutes).mul(
        config.latePenaltyPerMinute,
      ),
      missingPunch,
      missingPunchPenalty: missingPunch
        ? config.missingPunchPenalty
        : new Prisma.Decimal(0),
      overtimeMinutes,
      overtimeApprovedMinutes,
      sourceSnapshot: {
        schedule,
        attendanceId: attendance?.id ?? null,
      } as Prisma.InputJsonValue,
    };
  }

  private segmentMinutes(start: string, end: string) {
    return Math.max(0, this.timeMinutes(end) - this.timeMinutes(start));
  }
  private timeMinutes(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }
  private round(value: number, increment: number) {
    return Math.round(value / increment) * increment;
  }
  private day(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  private isoDay(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
