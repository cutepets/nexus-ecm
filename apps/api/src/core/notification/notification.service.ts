import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * In-app notifications. Creates `Notification` rows for a user. Email delivery
 * (BullMQ workers) is layered on in Phase 13; failures never break the caller.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyUser(userId: string, input: NotifyInput) {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: (input.data as object) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Notification failed for user ${userId}: ${(err as Error).message}`);
    }
  }

  /** Resolve an employee's linked user account and notify them (no-op if unlinked). */
  async notifyEmployee(employeeId: string, input: NotifyInput) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    if (employee?.userId) await this.notifyUser(employee.userId, input);
  }

  /** Notify every user holding a given role (e.g. all HR). */
  async notifyRole(roleName: string, input: NotifyInput) {
    const users = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: roleName } } }, isActive: true },
      select: { id: true },
    });
    await Promise.all(users.map((u) => this.notifyUser(u.id, input)));
  }
}
