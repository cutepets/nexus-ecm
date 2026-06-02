import { Injectable } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Executive KPI summary aggregated across modules. */
  async summary() {
    const today = new Date();
    const workDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalEmployees,
      activeEmployees,
      presentToday,
      activeProjects,
      pendingTasks,
      pendingLeaves,
      monthIncome,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, workStatus: { in: ['PERMANENT', 'CONTRACT', 'PROBATION'] } } }),
      this.prisma.attendance.count({ where: { workDate, status: { in: ['PRESENT', 'LATE'] } } }),
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.task.count({ where: { status: { not: 'DONE' } } }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      presentToday,
      activeProjects,
      pendingTasks,
      pendingLeaves,
      monthIncome: Number(monthIncome._sum.amount ?? 0),
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
