import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

export type ResolvedWorkSchedule = {
  workSchedule: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    secondStartTime: string | null;
    secondEndTime: string | null;
  };
  source: 'ROSTER' | 'OVERRIDE' | 'ASSIGNMENT';
  overrideId?: string;
  assignmentId?: string;
};

@Injectable()
export class ScheduleResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the saved daily roster first, then legacy overrides/assignments. */
  async resolve(employeeId: string, workDate: Date): Promise<ResolvedWorkSchedule | null> {
    const day = this.dateOnly(workDate);
    const roster = await this.prisma.employeeDailySchedule.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: day } },
      include: {
        workSchedule: true,
        segments: { orderBy: { sequence: 'asc' }, select: { startTime: true, endTime: true } },
      },
    });
    if (roster) {
      const segments = roster.segments;
      return {
        workSchedule: {
          ...roster.workSchedule,
          name: roster.scheduleName,
          startTime: segments[0]?.startTime ?? roster.workSchedule.startTime,
          endTime: segments[0]?.endTime ?? roster.workSchedule.endTime,
          secondStartTime: segments[1]?.startTime ?? null,
          secondEndTime: segments[1]?.endTime ?? null,
        },
        source: 'ROSTER',
      };
    }
    const override = await this.prisma.employeeScheduleOverride.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: day } },
      include: { workSchedule: true },
    });
    if (override) return {
      workSchedule: override.workSchedule,
      source: 'OVERRIDE',
      overrideId: override.id,
    };

    const assignment = await this.prisma.employeeWorkScheduleAssignment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: day },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] },
          { OR: [{ weekdays: { isEmpty: true } }, { weekdays: { has: day.getUTCDay() } }] },
        ],
      },
      include: { workSchedule: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return assignment ? {
      workSchedule: assignment.workSchedule,
      source: 'ASSIGNMENT',
      assignmentId: assignment.id,
    } : null;
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
