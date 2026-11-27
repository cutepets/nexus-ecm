import { Injectable } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { workDateInTimeZone } from '../../common/utils/company-time';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Executive KPI summary aggregated across modules. */
  async summary() {
    const today = new Date();
    const setting = await this.prisma.companySetting.findUnique({ where: { id: 'default' }, select: { timezone: true } });
    const workDate = workDateInTimeZone(today, setting?.timezone ?? 'Asia/Ho_Chi_Minh');
    const [
      totalEmployees,
      activeEmployees,
      presentToday,
      activeProjects,
      pendingTasks,
      pendingLeaves,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, workStatus: { in: ['PERMANENT', 'PROBATION'] } } }),
      this.prisma.attendance.count({ where: { workDate, status: { in: ['PRESENT', 'LATE'] } } }),
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.task.count({ where: { status: { not: 'DONE' } } }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      presentToday,
      activeProjects,
      pendingTasks,
      pendingLeaves,
    };
  }

  /** Recent activity from the audit log. */
  recentActivity() {
    return this.prisma.auditLog.findMany({
      include: { actor: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
  }

  /** Audit log viewer with optional filters. */
  auditLogs(filters: { entity?: string; action?: string; actorId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.action ? { action: filters.action as Prisma.AuditLogWhereInput['action'] } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
    };
    return this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
